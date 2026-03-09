# SkillSwap Setup Guide

Welcome to SkillSwap! This platform is built entirely serverless, relying on **Vanilla HTML/CSS/JS**, **Firebase** (Auth & Firestore) for the backend logic, and **WebRTC** for P2P video calls.

Follow these steps to deploy and test the application perfectly on GitHub Pages.

---

## 1. Firebase Setup

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Create a project**. Name it something like `skillswap-app`.
3. Disable Google Analytics (optional, to keep things simple).
4. Once the project is created, click the **Web icon (</>)** to add a web app.
5. Register the app (you don't need to set up Firebase Hosting if you plan to use GitHub Pages).
6. Copy the `firebaseConfig` object provided by Firebase.

### Configure Application Secrets
Open `js/auth.js` in your local project folder. Locate line 10 and replace the placeholder `firebaseConfig` block with the one you just copied:

```javascript
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};
```

### Enable Authentication Services
1. In the Firebase left sidebar, click **Authentication** under the Build menu.
2. Click **Get Started**.
3. Go to the **Sign-in method** tab.
4. Enable **Email/Password** and click **Save**.

### Enable Firestore Database
1. In the left sidebar, click **Firestore Database** under the Build menu.
2. Click **Create database**.
3. Choose **Cloud Firestore location** (e.g., `us-central`).
4. Start in **Test mode** to permit reading and writing during development without complex rules. *(Note: Test mode expires in 30 days. For production, apply proper timestamp rules).*

---

## 2. Deploying to GitHub Pages

Since the app uses no backend, Node.js servers, or build steps like React, GitHub Pages is the perfect free hosting platform.

1. Open a terminal in the `skillswap` directory.
2. Initialize a local git repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of SkillSwap"
   ```
3. Go to [GitHub](https://github.com/) and create a new public repository named `skillswap`.
4. Run the commands provided by GitHub to link and push your code:
   ```bash
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/skillswap.git
   git push -u origin main
   ```
5. In your GitHub repository, go to **Settings** > **Pages** (on the left menu).
6. Under **Source**, select the `main` branch and the `/root` folder. Click Save.
7. In a few minutes, your site will be live at `https://YOUR_USERNAME.github.io/skillswap/`.

---

## 3. WebRTC Call Flow Explanation

When testing the video call feature locally or on GitHub Pages:
1. One user goes into `call.html` and clicks **"Start Call"** to create a Room.
   - This records an 'Offer' in the `calls` collection inside Firestore.
2. The UI will prompt a `Room ID`. The user copies this ID.
   - The user opens their messages tab and shares this string ID with their match.
3. The matched user opens `call.html`, pastes the `Room ID`, and clicks **"Join Call"**.
   - This records an 'Answer' in Firestore.
4. The devices exchange networking (ICE) candidates automatically, and the video stream is established peer-to-peer!

> **Warning:** You may need HTTPS applied (provided automatically by GitHub Pages) for browsers to allow camera/microphone access. If testing locally via `file://` or HTTP, you must permit `localhost`.

Enjoy trading your skills!
