"use client";

import React, { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capawesome-team/capacitor-file-opener';
import { Toast } from '@capacitor/toast';
import axios from 'axios';
import { logFirebaseVersionInfo } from '../utils/firebase';

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

export const AppUpdater: React.FC<{ appName: string; currentVersion?: string }> = ({ appName, currentVersion: propVersion }) => {
  const [newVersion, setNewVersion] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const isDownloadingRef = useRef(false);

  useEffect(() => {
    // Run on startup
    checkForUpdates();

    // Check periodically every 10 minutes (600,000ms)
    const intervalId = setInterval(() => {
      checkForUpdates();
    }, 600000);

    // Setup listener for app resume (coming back from background)
    let appStateListener: any = null;
    try {
      const plugins = (Capacitor as any).Plugins as Record<string, any> | undefined;
      const AppPlugin = plugins?.["App"];
      if (AppPlugin) {
        appStateListener = AppPlugin.addListener("resume", () => {
          console.log("App resumed, checking for updates...");
          checkForUpdates();
        });
      }
    } catch (e) {
      console.warn("Failed to set up App resume listener:", e);
    }

    return () => {
      clearInterval(intervalId);
      if (appStateListener && typeof appStateListener.remove === 'function') {
        appStateListener.remove();
      }
    };
  }, []);

  const showToast = async (text: string) => {
    try {
      if (Capacitor.isNativePlatform()) {
        await Toast.show({ text, duration: 'short' });
      } else {
        console.log(`[Toast Simulation]: ${text}`);
      }
    } catch (e) {
      console.warn("Toast failed:", e);
    }
  };

  const checkForUpdates = async () => {
    // If already downloading, don't check/restart
    if (isDownloading || isDownloadingRef.current) return;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sbjiwala.qzz.io/api/v1';
      const response = await axios.get<LatestRelease>(`${apiUrl}/system/latest-release`);
      const latestRelease = response.data;

      const currentVersion = propVersion || process.env.NEXT_PUBLIC_APP_VERSION || '1.0';

      if (latestRelease.version) {
        logFirebaseVersionInfo(currentVersion, latestRelease.version).catch(err => {
          console.warn("Failed to log Firebase version info:", err);
        });
      }

      if (latestRelease.version && latestRelease.version !== currentVersion) {
        const targetAsset = latestRelease.assets.find(a => {
          if (!a.name.endsWith('.apk')) return false;

          const nameLower = a.name.toLowerCase();
          if (appName === 'customer') {
            return !nameLower.includes('vendor') &&
              !nameLower.includes('delivery') &&
              !nameLower.includes('courier') &&
              !nameLower.includes('admin') &&
              !nameLower.includes('agent') &&
              !nameLower.includes('support');
          } else {
            if (appName === 'agent') {
              return nameLower.includes('agent') || nameLower.includes('support');
            }
            if (appName === 'delivery') {
              return nameLower.includes('delivery') || nameLower.includes('courier');
            }
            return nameLower.includes(appName.toLowerCase());
          }
        });

        if (targetAsset) {
          setNewVersion(latestRelease.version);
          setDownloadUrl(targetAsset.browser_download_url);

          // Silently and automatically start download in background
          startDownload(targetAsset.browser_download_url, latestRelease.version);
        }
      }
    } catch (error) {
      console.error('Update check failed:', error);
    }
  };

  const startDownload = async (url: string, version: string) => {
    if (isDownloading || isDownloadingRef.current) return;
    setIsDownloading(true);
    isDownloadingRef.current = true;
    setDownloadProgress(0);

    try {
      await showToast(`New update v${version} found. Downloading in background...`);

      const fileName = `update_${appName}_v${version}.apk`;

      if (Capacitor.getPlatform() !== 'android') {
        // Mock download/progress on web/dev environment for preview and safety
        console.log("Simulating background download on non-android platform...");
        for (let p = 0; p <= 100; p += 10) {
          setDownloadProgress(p);
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        setDownloadProgress(null);
        setIsDownloading(false);
        isDownloadingRef.current = false;
        await showToast('Simulation complete. (Install skipped on web)');
        return;
      }

      // Use Capacitor native downloadFile to download directly to device storage.
      // This avoids CORS issues in the WebView and memory crash issues when converting large binaries.
      const progressListener = await Filesystem.addListener('progress', (progress) => {
        if (progress.contentLength) {
          const percentage = (progress.bytes / progress.contentLength) * 100;
          setDownloadProgress(percentage);
        }
      });

      try {
        await Filesystem.downloadFile({
          url: url,
          path: fileName,
          directory: Directory.Cache,
          progress: true
        });
      } finally {
        await progressListener.remove();
      }

      setDownloadProgress(null);
      setIsDownloading(false);
      isDownloadingRef.current = false;

      const uriResult = await Filesystem.getUri({
        path: fileName,
        directory: Directory.Cache
      });

      if (uriResult.uri) {
        await showToast('Download complete. Installing...');
        await FileOpener.openFile({
          path: uriResult.uri,
          mimeType: 'application/vnd.android.package-archive',
        });
      }
    } catch (error) {
      console.error('Download/Install failed:', error);
      setDownloadProgress(null);
      setIsDownloading(false);
      isDownloadingRef.current = false;
      await showToast('Could not download or install update.' + `${error}`);
    }
  };

  return (
    <>
      {downloadProgress !== null && (
        <div style={{
          position: 'fixed',
          bottom: '56px', // Directly above the footer menu
          left: 0,
          right: 0,
          zIndex: 99999,
          pointerEvents: 'none',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          width: '100%',
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 12px',
            fontSize: '10px',
            fontWeight: 'bold',
            color: '#10b981',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            backdropFilter: 'blur(8px)',
            width: '100%',
            boxSizing: 'border-box',
            borderTop: '1px solid rgba(16, 185, 129, 0.2)',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                backgroundColor: '#10b981',
                borderRadius: '50%',
                display: 'inline-block',
                animation: 'updater-pulse 1.5s infinite'
              }} />
              Downloading Sbjiwala Update (v{newVersion})...
            </span>
            <span>{Math.round(downloadProgress)}%</span>
          </div>
          <div style={{
            width: '100%',
            backgroundColor: 'rgba(16, 185, 129, 0.1)',
            height: '3px',
            overflow: 'hidden',
          }}>
            <div style={{
              backgroundColor: '#10b981',
              height: '100%',
              width: `${downloadProgress}%`,
              transition: 'width 0.2s ease-out',
              boxShadow: '0 0 8px #10b981'
            }} />
          </div>
          <style>{`
            @keyframes updater-pulse {
              0% { opacity: 0.3; }
              50% { opacity: 1; }
              100% { opacity: 0.3; }
            }
          `}</style>
        </div>
      )}
    </>
  );
};
