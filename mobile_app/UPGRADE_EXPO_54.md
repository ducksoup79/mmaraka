# Upgrade to Expo SDK 54

`package.json` has been updated to **Expo ~54.0.0** with:

- **expo** ~54.0.0  
- **react** 19.1.0  
- **react-native** 0.81.5  
- **Node.js** >= 20.19.4 (set in `engines`)

## Steps to finish the upgrade

1. **Stop the Expo dev server**  
   Stop any running `npx expo start` (Ctrl+C in that terminal).

2. **Fix `node_modules` permissions** (if you see permission errors):
   ```bash
   cd mobile_testing/mobile_app
   sudo chown -R $(whoami):staff node_modules
   ```
   If that doesn’t work, remove `node_modules` with sudo and reinstall:
   ```bash
   sudo rm -rf node_modules
   rm -f package-lock.json
   ```

3. **Upgrade Node.js** (Expo 54 needs Node >= 20.19.4):
   ```bash
   node -v   # should be v20.19.4 or higher
   ```
   If needed, upgrade via nvm: `nvm install 20.19.4` then `nvm use 20.19.4`.

4. **Install dependencies**:
   ```bash
   npm install
   npx expo install --fix
   ```
   `expo install --fix` aligns all Expo-related packages to versions compatible with SDK 54.

5. **Start the app**:
   ```bash
   npx expo start -c
   ```
   Use an **Expo Go** build that supports SDK 54, or create a new dev build.

## Notes

- React Navigation is still on **6.x** for compatibility with the current screens.
- If you see peer dependency or compatibility warnings, run `npx expo install --fix` again after fixing any issues it reports.
