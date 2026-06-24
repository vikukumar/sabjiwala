import React, { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { Dialog } from '@capacitor/dialog';
import { Toast } from '@capacitor/toast';
import axios from 'axios';

interface ReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  content_type: string;
}

interface LatestRelease {
  version: string;
  name: string;
  body: string;
  assets: ReleaseAsset[];
}

export const AppUpdater: React.FC<{ appName: string }> = ({ appName }) => {
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    // Only run on native Android
    if (Capacitor.getPlatform() !== 'android') return;
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      setIsChecking(true);
      // Construct API URL
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sbjiwala.qzz.io/api/v1';
      const response = await axios.get<LatestRelease>(`${apiUrl}/system/latest-release`);
      const latestRelease = response.data;

      const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || '1.0';
      
      // Compare versions (simple string compare or semver, assuming simple format like 1.0.42)
      if (latestRelease.version && latestRelease.version !== currentVersion) {
        // Find the right APK asset for this app
        const expectedApkPrefix = `sbjiwala-${appName === 'customer' ? '' : appName + '-'}`;
        // e.g. sbjiwala-v1.0.42.apk or sbjiwala-vendor-v1.0.42.apk
        const targetAsset = latestRelease.assets.find(a => 
          a.name.endsWith('.apk') && 
          ((appName === 'customer' && a.name.startsWith('sbjiwala-v')) || 
           (appName !== 'customer' && a.name.startsWith(`sbjiwala-${appName}-v`)))
        );

        if (targetAsset) {
          await promptForUpdate(latestRelease.version, targetAsset.browser_download_url);
        }
      }
    } catch (error) {
      console.error('Update check failed:', error);
    } finally {
      setIsChecking(false);
    }
  };

  const promptForUpdate = async (newVersion: string, downloadUrl: string) => {
    const { value } = await Dialog.confirm({
      title: 'Update Available',
      message: `A new version (${newVersion}) is available. Would you like to update now?`,
      okButtonTitle: 'Update',
      cancelButtonTitle: 'Later'
    });

    if (value) {
      await downloadAndInstall(downloadUrl, newVersion);
    }
  };

  const downloadAndInstall = async (url: string, version: string) => {
    try {
      await Toast.show({ text: 'Downloading update in background...', duration: 'long' });
      
      const fileName = `update_v${version}.apk`;
      
      const downloadResult = await Filesystem.downloadFile({
        url: url,
        path: fileName,
        directory: Directory.Cache,
      });

      if (downloadResult.path) {
        await Toast.show({ text: 'Download complete. Installing...', duration: 'short' });
        await FileOpener.openFile({
          path: downloadResult.path,
          mimeType: 'application/vnd.android.package-archive',
        });
      }
    } catch (error) {
      console.error('Download/Install failed:', error);
      await Dialog.alert({
        title: 'Update Failed',
        message: 'Could not download or install the update. Please try again later.'
      });
    }
  };

  return null; // This is a background component
};
