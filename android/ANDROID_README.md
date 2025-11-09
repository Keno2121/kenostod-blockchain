# Kenostod Academy Android App

Android native app for the Kenostod Blockchain Academy with integrated ICO functionality.

---

## 🚀 Features

### Core Features
✅ **Live Website Integration** - Loads kenostodblockchain.com in native app  
✅ **Offline Caching** - Works without internet once loaded  
✅ **Push Notifications** - Ready for ICO announcements  
✅ **Deep Linking** - Direct links to ICO presale  

### ICO-Specific Features
✅ **ICO Deep Links** - `keno://ico` opens presale directly  
✅ **Wallet Integration** - `keno://wallet` opens wallet tab  
✅ **Native Sharing** - Share ICO with Android share sheet  
✅ **ICO Status Checking** - Check presale status natively  
✅ **Web3 Ready** - Camera permission for QR code scanning  

---

## 📱 Setup Instructions

### 1. Open in Android Studio

```bash
# Extract the project if you haven't already
tar -xzf kenostod-android-project.tar.gz

# Open Android Studio
# File → Open → Select 'android' folder
```

### 2. Install Dependencies

Android Studio will automatically:
- Download Gradle dependencies
- Sync Capacitor plugins
- Configure build tools

**If prompted to upgrade Gradle or Android Gradle Plugin, click "Don't remind me again"**

### 3. Configure Signing (For Release Build)

Create `android/keystore.properties`:

```properties
storeFile=keystore.jks
storePassword=YOUR_PASSWORD
keyAlias=kenostod
keyPassword=YOUR_PASSWORD
```

Generate keystore:

```bash
keytool -genkey -v -keystore android/app/keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias kenostod
```

### 4. Build & Run

#### Development Build:
```bash
# Connect Android device or start emulator
# Click "Run" (green play button) in Android Studio
```

#### Release Build (For Play Store):
```bash
cd android
./gradlew assembleRelease

# APK will be in: app/build/outputs/apk/release/app-release.apk
```

---

## 🔗 Deep Linking Usage

Users can open the app directly to specific features:

### Open ICO Presale:
```html
<a href="keno://ico">Join KENO ICO</a>
```

### Open Wallet:
```html
<a href="keno://wallet">View KENO Balance</a>
```

### From Email/SMS:
Send users links like:
- `keno://ico` - Opens presale page
- `keno://wallet` - Opens wallet

---

## 🌐 Web Integration

The app communicates with your web platform using JavaScript:

```javascript
// Check if running in Android app
if (window.Capacitor && window.Capacitor.isNativePlatform()) {
    // Running in Android app
    
    // Call native ICO functions
    const ICOPlugin = Capacitor.Plugins.ICOPlugin;
    
    // Check if Android
    const result = await ICOPlugin.isAndroidApp();
    console.log(result.isAndroid); // true
    
    // Open ICO presale
    await ICOPlugin.openICO();
    
    // Share ICO
    await ICOPlugin.shareICO({
        message: "Join the KENO Token ICO!",
        url: "https://kenostodblockchain.com"
    });
    
    // Check ICO status
    const status = await ICOPlugin.checkICOStatus();
    console.log(status.phase); // "public_sale"
}
```

---

## 📊 Publishing to Google Play Store

### 1. Prepare Release Build

```bash
cd android
./gradlew bundleRelease

# AAB file: app/build/outputs/bundle/release/app-release.aab
```

### 2. Create Play Store Listing

1. Go to [Google Play Console](https://play.google.com/console)
2. Create new app
3. Upload AAB file
4. Fill in app details:
   - **Title:** Kenostod Blockchain Academy
   - **Short description:** Learn blockchain with hands-on cryptocurrency simulation
   - **Category:** Education
   - **Content rating:** Everyone

### 3. Required Assets

- **App icon:** 512×512px PNG (use existing ic_launcher)
- **Feature graphic:** 1024×500px
- **Screenshots:** At least 2 screenshots (phone + tablet)
- **Privacy policy URL:** Required if collecting data

### 4. Submit for Review

- Set pricing (Free)
- Select countries
- Click "Submit for review"
- Wait 1-3 days for approval

---

## 🔒 Security Configuration

### Network Security:
- HTTPS enforced for all network traffic
- Local development allows HTTP on localhost
- Cleartext traffic disabled in production

### Permissions:
- ✅ Internet (required for website loading)
- ✅ Network state (check connectivity)
- ✅ Camera (QR code scanning for wallet)
- ✅ Vibrate (haptic feedback)
- ✅ Billing (Google Play in-app purchases)

---

## 🎨 Customization

### Change App Icon:

Replace these files in `app/src/main/res/`:
- `mipmap-hdpi/ic_launcher.png` (72×72px)
- `mipmap-mdpi/ic_launcher.png` (48×48px)
- `mipmap-xhdpi/ic_launcher.png` (96×96px)
- `mipmap-xxhdpi/ic_launcher.png` (144×144px)
- `mipmap-xxxhdpi/ic_launcher.png` (192×192px)

### Change Splash Screen:

Replace `res/drawable/splash.png` with your branded splash screen.

Update splash color in `capacitor.config.json`:
```json
"backgroundColor": "#667eea"
```

### Change App Name:

Edit `res/values/strings.xml`:
```xml
<string name="app_name">Your App Name</string>
```

---

## 🧪 Testing

### Test Deep Links:

```bash
# Open ICO presale
adb shell am start -W -a android.intent.action.VIEW -d "keno://ico" com.kenostod.academy

# Open wallet
adb shell am start -W -a android.intent.action.VIEW -d "keno://wallet" com.kenostod.academy
```

### Test on Physical Device:

1. Enable **Developer Options** on Android phone
2. Enable **USB Debugging**
3. Connect via USB
4. Click "Run" in Android Studio

---

## 📦 Project Structure

```
android/
├── app/
│   ├── src/main/
│   │   ├── java/com/kenostod/academy/
│   │   │   ├── MainActivity.java       # Main activity with deep linking
│   │   │   └── ICOPlugin.java          # ICO native features
│   │   ├── res/                        # Resources (icons, layouts, strings)
│   │   ├── assets/
│   │   │   └── capacitor.config.json   # Capacitor configuration
│   │   └── AndroidManifest.xml         # App permissions & config
│   └── build.gradle                    # App dependencies
├── gradle/                             # Gradle wrapper
└── build.gradle                        # Project config
```

---

## 🐛 Troubleshooting

### "Failed to load website"
- Check internet connection
- Verify `capacitor.config.json` has correct server URL
- Check `kenostodblockchain.com` is accessible

### "Deep links not working"
- Verify intent filters in `AndroidManifest.xml`
- Test with ADB command (see Testing section)
- Check logcat for errors: `adb logcat | grep Kenostod`

### "Build failed"
- Clean project: Build → Clean Project
- Invalidate caches: File → Invalidate Caches / Restart
- Update Gradle: `./gradlew wrapper --gradle-version 8.0`

### "Web3 wallet not connecting"
- Ensure CAMERA permission is granted
- Check network security config allows HTTPS
- Verify user has MetaMask or Trust Wallet installed

---

## 🚀 Next Steps

1. ✅ **Test the app** in Android Studio emulator
2. ✅ **Test deep links** with ADB commands
3. ✅ **Create release build** with signing key
4. ✅ **Prepare Play Store assets** (screenshots, descriptions)
5. ✅ **Submit to Play Store** for review
6. ✅ **Promote app** to Academy users

---

## 💡 ICO Integration Tips

### In Your Web Code:

```javascript
// Detect Android app
const isAndroid = window.Capacitor && window.Capacitor.getPlatform() === 'android';

if (isAndroid) {
    // Hide browser-specific features
    // Show "Share on Android" button instead of social links
    
    const ICOPlugin = window.Capacitor.Plugins.ICOPlugin;
    
    // Add share button
    document.getElementById('shareICO').onclick = async () => {
        await ICOPlugin.shareICO({
            message: "Join KENO ICO",
            url: "https://kenostodblockchain.com"
        });
    };
}
```

### Marketing Deep Links:

Email campaigns:
```html
<a href="keno://ico">Buy KENO Tokens Now!</a>
```

SMS campaigns:
```
Join the KENO ICO! Click: keno://ico
```

Social media bios:
```
Install our app: [Play Store Link]
Direct presale: keno://ico
```

---

## 📞 Support

For Android app issues:
- Check logcat: `adb logcat | grep Kenostod`
- Review Android Studio build output
- Test on multiple devices/API levels

---

**Built for Kenostod Blockchain Academy**  
**Version:** 1.0  
**Last Updated:** November 8, 2025
