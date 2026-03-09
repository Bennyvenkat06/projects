import { db, auth } from "./auth.js";
import { currentUserProfile, addSwipeRecord } from "./database.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

let potentialMatches = [];
let currentCardIndex = 0;

// Listen for profile load completion
window.addEventListener('userProfileLoaded', async (e) => {
    const uid = e.detail;
    if (window.location.pathname.includes('dashboard.html')) {
        await loadPotentialMatches(uid);
        renderNextCard();
    }
});

// ============================================================================
// Matchmaking Algorithm
// ============================================================================
async function loadPotentialMatches(currentUid) {
    if (!currentUserProfile) return;

    try {
        const usersRef = collection(db, "users");
        // We fetch all users except self (In production, use GeoQueries or Cloud Functions)
        // For vanilla client-side simulation, we fetch all users and filter locally.
        const q = query(usersRef, where("uid", "!=", currentUid));
        const querySnapshot = await getDocs(q);

        const myWants = currentUserProfile.skills_wanted || [];
        const myOffers = currentUserProfile.skills_offered || [];
        const alreadySwiped = [
            ...(currentUserProfile.swipedRight || []),
            ...(currentUserProfile.swipedLeft || [])
        ];

        let loadedUsers = [];
        querySnapshot.forEach((doc) => {
            loadedUsers.push(doc.data());
        });

        potentialMatches = loadedUsers.filter(user => {
            // Remove if already swiped
            if (alreadySwiped.includes(user.uid)) return false;

            // Simple Matching Logic:
            // Do they offer what I want? OR Do they want what I offer?
            // To be shown, at least one condition must be met for a loose matchmaking economy.
            
            const theyOffer = user.skills_offered || [];
            const theyWant = user.skills_wanted || [];

            const iWantWhatTheyOffer = myWants.some(skill => theyOffer.includes(skill));
            const theyWantWhatIOffer = theyWant.some(skill => myOffers.includes(skill));

            return iWantWhatTheyOffer || theyWantWhatIOffer;
        });

        // Optional: Sort by "Match Quality" (mutual hits > one-sided hits)
        potentialMatches.sort((a, b) => {
            const aOffer = a.skills_offered || [];
            const aWant = a.skills_wanted || [];
            const bOffer = b.skills_offered || [];
            const bWant = b.skills_wanted || [];

            let aScore = 0;
            if (myWants.some(s => aOffer.includes(s))) aScore++;
            if (aWant.some(s => myOffers.includes(s))) aScore++;

            let bScore = 0;
            if (myWants.some(s => bOffer.includes(s))) bScore++;
            if (bWant.some(s => myOffers.includes(s))) bScore++;

            return bScore - aScore;
        });

    } catch (error) {
        console.error("Error loading matches:", error);
    }
}

// ============================================================================
// Deck Rendering & UI Swiping Logic
// ============================================================================
function renderNextCard() {
    const deckContainer = document.getElementById('tinder-deck');
    const noMoreCardsMsg = document.getElementById('no-more-cards');
    
    if (!deckContainer) return;

    deckContainer.innerHTML = ''; // Clear current

    if (currentCardIndex >= potentialMatches.length) {
        noMoreCardsMsg.style.display = 'block';
        document.querySelector('.deck-controls').style.display = 'none';
        return;
    }

    noMoreCardsMsg.style.display = 'none';
    const user = potentialMatches[currentCardIndex];

    const card = document.createElement('div');
    card.className = 'match-card';
    card.setAttribute('data-uid', user.uid);

    const offersHTML = (user.skills_offered || []).map(s => `<span class="chip chip-has">${s}</span>`).join('');
    const wantsHTML = (user.skills_wanted || []).map(s => `<span class="chip chip-wants">${s}</span>`).join('');

    card.innerHTML = `
        <div class="mc-image-area">
            <img src="${user.photoURL || 'https://i.pravatar.cc/150'}" alt="${user.username} photo" draggable="false">
            <div class="mc-image-overlay">
                <h3>${user.username} <span style="font-size:1rem;font-weight:normal;opacity:0.8">⭐ ${user.ratings}</span></h3>
            </div>
        </div>
        <div class="mc-content">
            <div class="skill-list" style="margin-bottom:0.5rem">
                <h5>Offers</h5>
                <div class="skill-chips">${offersHTML || '<span class="text-muted">No specific skills listed</span>'}</div>
            </div>
            <div class="skill-list" style="margin-bottom:1rem">
                <h5>Wants</h5>
                <div class="skill-chips">${wantsHTML || '<span class="text-muted">No specific skills requested</span>'}</div>
            </div>
            <div class="mc-bio">${user.bio || 'Wants to swap skills and learn!'}</div>
        </div>
    `;

    deckContainer.appendChild(card);
    setupCardDrag(card);
}

// Global button controls
document.addEventListener('DOMContentLoaded', () => {
    const btnNope = document.getElementById('deck-nope');
    const btnLike = document.getElementById('deck-like');

    if (btnNope) btnNope.addEventListener('click', () => handleButtonSwipe('left'));
    if (btnLike) btnLike.addEventListener('click', () => handleButtonSwipe('right'));
});

function handleButtonSwipe(direction) {
    const deckContainer = document.getElementById('tinder-deck');
    const card = deckContainer.querySelector('.match-card');
    if (!card) return;

    const targetUid = card.getAttribute('data-uid');
    
    const xTranslate = direction === 'left' ? -300 : 300;
    const rotate = direction === 'left' ? -20 : 20;

    card.style.transition = 'transform 0.4s ease-out, opacity 0.4s';
    card.style.transform = `translate(${xTranslate}px, 50px) rotate(${rotate}deg)`;
    card.style.opacity = '0';

    setTimeout(() => {
        executeSwipe(targetUid, direction);
    }, 400);
}

function setupCardDrag(card) {
    let isDragging = false;
    let startX = 0;
    let currentX = 0;

    const onDragStart = (e) => {
        isDragging = true;
        startX = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        card.style.transition = 'none';
    };

    const onDragMove = (e) => {
        if (!isDragging) return;
        const x = e.type.includes('mouse') ? e.clientX : e.touches[0].clientX;
        currentX = x - startX;
        const rotate = currentX * 0.05;
        card.style.transform = `translate(${currentX}px, 0) rotate(${rotate}deg)`;
        
        // Optional visual hint - background color based on direction
        if (currentX > 50) {
            document.getElementById('deck-like').style.transform = 'scale(1.2)';
        } else if (currentX < -50) {
            document.getElementById('deck-nope').style.transform = 'scale(1.2)';
        } else {
            document.getElementById('deck-like').style.transform = 'scale(1)';
            document.getElementById('deck-nope').style.transform = 'scale(1)';
        }
    };

    const onDragEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        
        document.getElementById('deck-like').style.transform = 'scale(1)';
        document.getElementById('deck-nope').style.transform = 'scale(1)';

        const targetUid = card.getAttribute('data-uid');

        if (currentX > 100) {
            // Swipe Right
            card.style.transition = 'transform 0.3s ease-out, opacity 0.3s';
            card.style.transform = `translate(${window.innerWidth}px, 50px) rotate(30deg)`;
            card.style.opacity = '0';
            setTimeout(() => executeSwipe(targetUid, 'right'), 300);
        } else if (currentX < -100) {
            // Swipe Left
            card.style.transition = 'transform 0.3s ease-out, opacity 0.3s';
            card.style.transform = `translate(-${window.innerWidth}px, 50px) rotate(-30deg)`;
            card.style.opacity = '0';
            setTimeout(() => executeSwipe(targetUid, 'left'), 300);
        } else {
            // Snap back
            card.style.transition = 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            card.style.transform = 'translate(0, 0) rotate(0deg)';
        }
        currentX = 0;
    };

    card.addEventListener('mousedown', onDragStart);
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);

    card.addEventListener('touchstart', onDragStart, {passive: true});
    document.addEventListener('touchmove', onDragMove, {passive: true});
    document.addEventListener('touchend', onDragEnd);
}

function executeSwipe(targetUid, direction) {
    const currentUid = auth.currentUser.uid;
    
    // Save to Database
    addSwipeRecord(currentUid, targetUid, direction);
    
    // Render next
    currentCardIndex++;
    renderNextCard();
}
