import { auth, db } from "./auth.js";
import { doc, getDoc, updateDoc, onSnapshot, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Global variable to hold current user's database profile
export let currentUserProfile = null;

document.addEventListener('DOMContentLoaded', () => {
    
    // Only run database.js logic on dashboard
    if (!window.location.pathname.includes('dashboard.html')) return;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadUserProfile(user.uid);
            setupProfileForm(user.uid);
            listenToMatches(user.uid);
            
            // Dispatch custom event to let match.js know profile is ready
            const event = new CustomEvent('userProfileLoaded', { detail: user.uid });
            window.dispatchEvent(event);
        }
    });

});

// ============================================================================
// Profile Logic
// ============================================================================
async function loadUserProfile(uid) {
    try {
        const userDocRef = doc(db, "users", uid);
        const userSnap = await getDoc(userDocRef);
        
        if (userSnap.exists()) {
            currentUserProfile = userSnap.data();
            
            // Update Sidebar Sidebar Widget
            const nameEl = document.getElementById('current-user-name');
            const emailEl = document.getElementById('current-user-email');
            const avatarEl = document.getElementById('current-user-avatar');
            
            if(nameEl) nameEl.innerText = currentUserProfile.username;
            if(emailEl) emailEl.innerText = currentUserProfile.email;
            if(avatarEl && currentUserProfile.photoURL) avatarEl.src = currentUserProfile.photoURL;

            // Fill Profile Settings Form
            const pPhoto = document.getElementById('edit-photo');
            const pOffers = document.getElementById('edit-offers');
            const pWants = document.getElementById('edit-wants');
            const pBio = document.getElementById('edit-bio');

            if (pPhoto) pPhoto.value = currentUserProfile.photoURL || '';
            if (pOffers) pOffers.value = (currentUserProfile.skills_offered || []).join(', ');
            if (pWants) pWants.value = (currentUserProfile.skills_wanted || []).join(', ');
            if (pBio) pBio.value = currentUserProfile.bio || '';
        }
    } catch (error) {
        console.error("Error loading profile:", error);
    }
}

function setupProfileForm(uid) {
    const profileForm = document.getElementById('profile-form');
    const saveBtn = document.getElementById('save-profile-btn');
    const saveStatus = document.getElementById('save-status');

    if (!profileForm) return;

    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        saveBtn.innerText = 'Saving...';
        saveBtn.disabled = true;

        const photoURL = document.getElementById('edit-photo').value;
        const offersStr = document.getElementById('edit-offers').value;
        const wantsStr = document.getElementById('edit-wants').value;
        const bio = document.getElementById('edit-bio').value;

        const offers = offersStr.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== '');
        const wants = wantsStr.split(',').map(s => s.trim().toLowerCase()).filter(s => s !== '');

        try {
            const userRef = doc(db, "users", uid);
            await updateDoc(userRef, {
                photoURL: photoURL,
                skills_offered: offers,
                skills_wanted: wants,
                bio: bio
            });

            saveStatus.style.display = 'inline';
            setTimeout(() => { saveStatus.style.display = 'none'; }, 3000);
            
            // Reload sidebar info
            await loadUserProfile(uid);

        } catch (error) {
            console.error("Error updating profile:", error);
            alert("Failed to update profile.");
        } finally {
            saveBtn.innerText = 'Save Changes';
            saveBtn.disabled = false;
        }
    });
}

// ============================================================================
// Real-time Matches Listener
// ============================================================================
function listenToMatches(uid) {
    const matchesCountEl = document.getElementById('matches-count');
    const matchesGrid = document.getElementById('matches-grid');

    if (!matchesCountEl || !matchesGrid) return;

    // Listen to changes on the current user's document
    onSnapshot(doc(db, "users", uid), async (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();
        const matchesIds = data.matches || [];

        matchesCountEl.innerText = matchesIds.length;

        if (matchesIds.length === 0) {
            matchesGrid.innerHTML = '<p class="text-muted" style="grid-column: 1/-1;">No mutual matches yet. Keep swiping!</p>';
            return;
        }

        // Render matched users
        let gridHTML = '';
        
        // Note: For large scale apps, looping getDoc is bad. We use it here for purely static vanilla simplicity.
        for (const matchId of matchesIds) {
            try {
                const matchSnap = await getDoc(doc(db, "users", matchId));
                if (matchSnap.exists()) {
                    const mData = matchSnap.data();
                    gridHTML += `
                        <div class="mutual-match-card">
                            <img src="${mData.photoURL || 'https://i.pravatar.cc/150'}" alt="${mData.username}">
                            <h4>${mData.username}</h4>
                            <p style="font-size:0.75rem; color:var(--text-muted); margin-bottom: 0.5rem">
                                Wants: <strong>${(mData.skills_wanted || []).slice(0,2).join(', ')}</strong>
                            </p>
                            <p style="font-size:0.75rem; color:var(--text-muted);">
                                Offers: <strong>${(mData.skills_offered || []).slice(0,2).join(', ')}</strong>
                            </p>
                            <div class="match-actions">
                                <a href="chat.html?uid=${mData.uid}" class="btn btn-primary">Chat</a>
                                <a href="call.html" class="btn btn-secondary" title="Call Room">Call</a>
                            </div>
                        </div>
                    `;
                }
            } catch (err) {
                console.error("Error fetching match detail:", err);
            }
        }

        matchesGrid.innerHTML = gridHTML;
    });
}

// Helper exported to be used by match.js
export async function addSwipeRecord(uid, targetId, direction) {
    try {
        const userRef = doc(db, "users", uid);
        const fieldName = direction === 'right' ? 'swipedRight' : 'swipedLeft';
        await updateDoc(userRef, {
            [fieldName]: arrayUnion(targetId)
        });
        
        // If swiped right, check for mutual match
        if (direction === 'right') {
            const targetRef = doc(db, "users", targetId);
            const targetSnap = await getDoc(targetRef);
            if (targetSnap.exists()) {
                const targetData = targetSnap.data();
                const targetSwipedRight = targetData.swipedRight || [];
                
                if (targetSwipedRight.includes(uid)) {
                    // Mutual Match Found!
                    // Add to both users' matches array
                    await updateDoc(userRef, { matches: arrayUnion(targetId) });
                    await updateDoc(targetRef, { matches: arrayUnion(uid) });
                    
                    // Create chat document immediately
                    const chatRoomId = [uid, targetId].sort().join('_');
                    const chatRef = doc(db, "chats", chatRoomId);
                    const chatSnap = await getDoc(chatRef);
                    if (!chatSnap.exists()) {
                        import("https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js").then(({ setDoc }) => {
                            setDoc(chatRef, {
                                users: [uid, targetId],
                                messages: [],
                                lastUpdated: new Date().toISOString()
                            });
                        });
                    }
                    
                    // Native pop-up alert (In a real app, use a toast)
                    alert(`It's a Match with ${targetData.username} 🎉 Check your Matches tab!`);
                }
            }
        }
    } catch (e) {
        console.error("Error recording swipe:", e);
    }
}
