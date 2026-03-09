import { db, auth } from "./auth.js";
import { collection, doc, getDoc, onSnapshot, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

let currentChatId = null;
let currentChatUnsubscribe = null;
let matchedUsersCache = {}; 

document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('chat.html')) return;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            loadSidebarMatches(user.uid);
            setupMessageForm(user.uid);
            
            // If the URL has ?uid=xyz, open that chat immediately
            const urlParams = new URLSearchParams(window.location.search);
            const targetUid = urlParams.get('uid');
            if (targetUid) {
                openChat(user.uid, targetUid);
                // Trigger mobile layout shift if necessary
                if (window.openMobileChat) window.openMobileChat();
            }
        }
    });
});

// ============================================================================
// Sidebar Conversations List
// ============================================================================
function loadSidebarMatches(currentUid) {
    const convList = document.getElementById('conversations-list');
    
    // Listen to changes on the user's matches array
    onSnapshot(doc(db, "users", currentUid), async (docSnap) => {
        if (!docSnap.exists()) return;
        const matchesIds = docSnap.data().matches || [];
        
        if (matchesIds.length === 0) {
            convList.innerHTML = '<p style="text-align:center; color: var(--text-muted); padding: 2rem;">No matches yet.</p>';
            return;
        }

        let listHTML = '';
        
        for (const matchId of matchesIds) {
            // Cache user data to avoid redundant reads
            if (!matchedUsersCache[matchId]) {
                const matchSnap = await getDoc(doc(db, "users", matchId));
                if (matchSnap.exists()) {
                    matchedUsersCache[matchId] = matchSnap.data();
                }
            }
            
            const matchUser = matchedUsersCache[matchId];
            if (matchUser) {
                // Determine Chat ID
                const chatId = [currentUid, matchId].sort().join('_');
                
                listHTML += `
                    <div class="conv-item" data-uid="${matchId}" data-chatid="${chatId}">
                        <div class="conv-avatar">
                            <img src="${matchUser.photoURL || 'https://i.pravatar.cc/150'}" alt="${matchUser.username}">
                            <div class="online-dot" style="background:var(--success)"></div>
                        </div>
                        <div class="conv-info">
                            <div class="conv-top-row">
                                <h4>${matchUser.username}</h4>
                            </div>
                            <p class="conv-last-msg">Tap to view messages</p>
                        </div>
                    </div>
                `;
            }
        }
        
        convList.innerHTML = listHTML;
        
        // Add click events
        document.querySelectorAll('.conv-item').forEach(item => {
            item.addEventListener('click', () => {
                // Formatting
                document.querySelectorAll('.conv-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                
                const targetUid = item.getAttribute('data-uid');
                openChat(currentUid, targetUid);
                
                if (window.openMobileChat) window.openMobileChat(); // UI layout shift on mobile
            });
        });
    });
}

// ============================================================================
// Active Chat Window
// ============================================================================
function openChat(currentUid, targetUid) {
    document.getElementById('no-chat-overlay').style.display = 'none';
    
    // Set Header
    const matchUser = matchedUsersCache[targetUid];
    if (matchUser) {
        document.getElementById('active-chat-name').innerText = matchUser.username;
        document.getElementById('active-chat-avatar').src = matchUser.photoURL || 'https://i.pravatar.cc/150';
    }

    // Set Video Call Link
    const startVideoBtn = document.getElementById('start-video-btn');
    startVideoBtn.onclick = () => {
        window.location.href = `call.html?partner=${targetUid}`;
    };

    // Chat ID Convention
    currentChatId = [currentUid, targetUid].sort().join('_');
    
    // Unsubscribe from previous chat listener if exists
    if (currentChatUnsubscribe) {
        currentChatUnsubscribe();
    }

    // Subscribe to chat document
    const chatRef = doc(db, "chats", currentChatId);
    currentChatUnsubscribe = onSnapshot(chatRef, (chatSnap) => {
        if (chatSnap.exists()) {
            const data = chatSnap.data();
            renderMessages(data.messages || [], currentUid);
        } else {
            // Chat doesn't exist yet, it's empty
            renderMessages([], currentUid);
        }
    });
}

function renderMessages(messages, currentUid) {
    const historyContainer = document.getElementById('chat-history');
    historyContainer.innerHTML = '';
    
    if (messages.length === 0) {
        historyContainer.innerHTML = '<p style="text-align:center; color: var(--text-muted); margin-top: 2rem;">No messages yet. Say hello!</p>';
        return;
    }

    messages.forEach(msg => {
        const isSent = msg.senderId === currentUid;
        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const msgDiv = document.createElement('div');
        msgDiv.className = `msg-bubble ${isSent ? 'msg-sent' : 'msg-received'}`;
        msgDiv.innerHTML = `
            <p>${msg.text}</p>
            <span class="msg-time">${timeStr}</span>
        `;
        historyContainer.appendChild(msgDiv);
    });

    // Scroll to bottom
    setTimeout(() => {
        historyContainer.scrollTop = historyContainer.scrollHeight;
    }, 50);
}

// ============================================================================
// Message Sending
// ============================================================================
function setupMessageForm(currentUid) {
    const form = document.getElementById('chat-form');
    const input = document.getElementById('msg-input');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = input.value.trim();
        if (!text || !currentChatId) return;

        input.value = ''; // clear immediately for UX
        const newMessage = {
            senderId: currentUid,
            text: text,
            timestamp: new Date().toISOString()
        };

        try {
            const chatRef = doc(db, "chats", currentChatId);
            await updateDoc(chatRef, {
                messages: arrayUnion(newMessage),
                lastUpdated: new Date().toISOString()
            });
        } catch (error) {
            console.error("Error sending message:", error);
            // Revert on failure
            input.value = text;
        }
    });
}
