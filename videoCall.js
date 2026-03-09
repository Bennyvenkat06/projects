import { db } from "./auth.js";
import { collection, doc, setDoc, getDoc, updateDoc, onSnapshot, addDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// WebRTC Configuration
const servers = {
    iceServers: [
        { urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] }
    ],
    iceCandidatePoolSize: 10,
};

// Global State
const peerConnection = new RTCPeerConnection(servers);
let localStream = null;
let remoteStream = null;
let roomId = null; 
let isAudioMuted = false;
let isVideoMuted = false;

document.addEventListener('DOMContentLoaded', () => {
    if (!window.location.pathname.includes('call.html')) return;

    // Check if we came from chat with a partner intent
    const urlParams = new URLSearchParams(window.location.search);
    const intentPartner = urlParams.get('partner');
    
    if (intentPartner) {
        // In a more robust system, we would ring the partner here. 
        // For static simplicity, we just prompt the creator to start the room.
        document.getElementById('partner-name').innerText = "Starting call...";
    }

    // UI Bindings
    document.getElementById('create-btn').onclick = createRoom;
    document.getElementById('join-btn').onclick = joinRoom;
    
    document.getElementById('copy-room-btn').onclick = () => {
        const text = document.getElementById('current-room-display').value;
        navigator.clipboard.writeText(text);
        alert('Room ID copied to clipboard!');
    };

    document.getElementById('enter-room-btn').onclick = () => {
        setupMediaAndHideModal();
    };

    // Controls
    document.getElementById('toggle-mic').onclick = toggleMic;
    document.getElementById('toggle-cam').onclick = toggleCam;
    document.getElementById('end-call-btn').onclick = hangUp;
    document.getElementById('share-screen-btn').onclick = toggleScreenShare;
});

// ============================================================================
// Media Operations
// ============================================================================
async function setupLocalMedia() {
    if (localStream) return; // already acquired
    
    try {
        localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        remoteStream = new MediaStream();

        const localVideo = document.getElementById('localVideo');
        const remoteVideo = document.getElementById('remoteVideo');

        localVideo.srcObject = localStream;
        remoteVideo.srcObject = remoteStream;

        // Push tracks from local stream to peer connection
        localStream.getTracks().forEach((track) => {
            peerConnection.addTrack(track, localStream);
        });

        // Listen for remote tracks
        peerConnection.ontrack = (event) => {
            event.streams[0].getTracks().forEach((track) => {
                remoteStream.addTrack(track);
            });
            document.getElementById('status-banner').style.display = 'none';
            document.getElementById('connection-status').innerText = 'Connected';
            startTimer();
        };
        
        document.getElementById('status-banner').style.display = 'block';

    } catch (error) {
        console.error("Error accessing media devices.", error);
        alert("Camera/Microphone permissions are required for the call.");
    }
}

async function setupMediaAndHideModal() {
    await setupLocalMedia();
    document.getElementById('join-modal').style.display = 'none';
}

// ============================================================================
// Signaling Logic (Firestore)
// ============================================================================
async function createRoom() {
    document.getElementById('create-btn').disabled = true;
    document.getElementById('create-btn').innerText = 'Creating...';

    const roomRef = doc(collection(db, "calls"));
    roomId = roomRef.id;

    // Code for collecting ICE candidates below
    const callerCandidatesCollection = collection(roomRef, 'callerCandidates');
    peerConnection.onicecandidate = event => {
        if (!event.candidate) return;
        addDoc(callerCandidatesCollection, event.candidate.toJSON());
    };

    // Create Offer
    const offerDescription = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offerDescription);

    const roomWithOffer = {
        offer: {
            type: offerDescription.type,
            sdp: offerDescription.sdp,
        },
    };
    await setDoc(roomRef, roomWithOffer);

    // Show Room ID manually to share with partner via chat
    document.getElementById('create-btn').style.display = 'none';
    document.getElementById('room-created-msg').style.display = 'block';
    document.getElementById('current-room-display').value = roomId;

    // Listen for remote answer
    onSnapshot(roomRef, async snapshot => {
        const data = snapshot.data();
        if (data && data.answer && !peerConnection.currentRemoteDescription) {
            const rtcSessionDescription = new RTCSessionDescription(data.answer);
            await peerConnection.setRemoteDescription(rtcSessionDescription);
        }
    });

    // Listen for remote ICE candidates
    onSnapshot(collection(roomRef, 'calleeCandidates'), snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const data = change.doc.data();
                await peerConnection.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
}

async function joinRoom() {
    roomId = document.getElementById('room-id').value.trim();
    if (!roomId) return alert("Please enter a room ID.");
    
    document.getElementById('join-btn').disabled = true;
    document.getElementById('join-btn').innerText = 'Joining...';

    const roomRef = doc(db, "calls", roomId);
    const roomSnapshot = await getDoc(roomRef);

    if (!roomSnapshot.exists()) {
        document.getElementById('join-btn').disabled = false;
        document.getElementById('join-btn').innerText = 'Join Call';
        return alert("Room not found! Check the ID.");
    }

    await setupMediaAndHideModal();

    // Collect ICE Candidates
    const calleeCandidatesCollection = collection(roomRef, 'calleeCandidates');
    peerConnection.onicecandidate = event => {
        if (!event.candidate) return;
        addDoc(calleeCandidatesCollection, event.candidate.toJSON());
    };

    const offer = roomSnapshot.data().offer;
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    
    const answerDescription = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answerDescription);

    const roomWithAnswer = {
        answer: {
            type: answerDescription.type,
            sdp: answerDescription.sdp,
        },
    };
    await updateDoc(roomRef, roomWithAnswer);

    // Listen to caller ICE candidates
    onSnapshot(collection(roomRef, 'callerCandidates'), snapshot => {
        snapshot.docChanges().forEach(async change => {
            if (change.type === 'added') {
                const data = change.doc.data();
                await peerConnection.addIceCandidate(new RTCIceCandidate(data));
            }
        });
    });
}

// ============================================================================
// Controls
// ============================================================================
function toggleMic() {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        isAudioMuted = !audioTrack.enabled;
        
        const btn = document.getElementById('toggle-mic');
        const iconOn = document.getElementById('mic-on-icon');
        const iconOff = document.getElementById('mic-off-icon');
        
        if (isAudioMuted) {
            btn.classList.add('active-danger');
            iconOn.style.display = 'none';
            iconOff.style.display = 'block';
        } else {
            btn.classList.remove('active-danger');
            iconOn.style.display = 'block';
            iconOff.style.display = 'none';
        }
    }
}

function toggleCam() {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        isVideoMuted = !videoTrack.enabled;
        
        const btn = document.getElementById('toggle-cam');
        const iconOn = document.getElementById('cam-on-icon');
        const iconOff = document.getElementById('cam-off-icon');

        if (isVideoMuted) {
            btn.classList.add('active-danger');
            iconOn.style.display = 'none';
            iconOff.style.display = 'block';
        } else {
            btn.classList.remove('active-danger');
            iconOn.style.display = 'block';
            iconOff.style.display = 'none';
        }
    }
}

async function toggleScreenShare() {
    try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
        const screenTrack = displayStream.getVideoTracks()[0];

        // Replace the current video track on the PeerConnection
        const sender = peerConnection.getSenders().find(s => s.track.kind === 'video');
        if (sender) {
            sender.replaceTrack(screenTrack);
        }
        
        // Show local view also as screen
        document.getElementById('localVideo').srcObject = displayStream;

        screenTrack.onended = () => {
            // Revert to camera
            const cameraTrack = localStream.getVideoTracks()[0];
            if (sender) sender.replaceTrack(cameraTrack);
            document.getElementById('localVideo').srcObject = localStream;
        };
        
        document.getElementById('share-screen-btn').classList.add('active-success');

    } catch (e) {
        console.error("Screen sharing cancelled", e);
    }
}

function hangUp() {
    if (localStream) {
        localStream.getTracks().forEach(t => t.stop());
    }
    if (remoteStream) {
        remoteStream.getTracks().forEach(t => t.stop());
    }
    if (peerConnection) {
        peerConnection.close();
    }
    window.location.href = 'chat.html';
}

let timerInterval;
function startTimer() {
    let seconds = 0;
    const timerDisplay = document.getElementById('call-timer');
    timerInterval = setInterval(() => {
        seconds++;
        const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
        const secs = (seconds % 60).toString().padStart(2, '0');
        timerDisplay.innerText = `${mins}:${secs}`;
    }, 1000);
}
