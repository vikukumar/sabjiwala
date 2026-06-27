"use client";

import React, { useEffect, useState } from 'react';
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

export const AppUpdater: React.FC<{ appName: string }> = ({ appName }) => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [newVersion, setNewVersion] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    // Only run on native Android
    if (Capacitor.getPlatform() !== 'android') return;
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://sbjiwala.qzz.io/api/v1';
      const response = await axios.get<LatestRelease>(`${apiUrl}/system/latest-release`);
      const latestRelease = response.data;

      const currentVersion = process.env.NEXT_PUBLIC_APP_VERSION || '1.0';
      
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
          setShowPrompt(true);
        }
      }
    } catch (error) {
      console.error('Update check failed:', error);
    }
  };

  const handleConfirmUpdate = async () => {
    setShowPrompt(false);
    await startDownload();
  };

  const startDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    setDownloadProgress(0);

    try {
      await Toast.show({ text: 'Downloading update in background...', duration: 'long' });
      
      const fileName = `update_${appName}_v${newVersion}.apk`;
      
      // Perform HTTP request to download as arraybuffer for exact progress tracking
      const response = await axios({
        url: downloadUrl,
        method: 'GET',
        responseType: 'arraybuffer',
        onDownloadProgress: (progressEvent) => {
          if (progressEvent.total) {
            const progress = (progressEvent.loaded / progressEvent.total) * 100;
            setDownloadProgress(progress);
          }
        }
      });

      // Convert arraybuffer to base64
      let binary = '';
      const bytes = new Uint8Array(response.data);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64Content = window.btoa(binary);

      // Write base64 content to Filesystem
      const writeResult = await Filesystem.writeFile({
        path: fileName,
        data: base64Content,
        directory: Directory.Cache
      });

      setDownloadProgress(null);
      setIsDownloading(false);

      if (writeResult.uri) {
        await Toast.show({ text: 'Download complete. Installing...', duration: 'short' });
        await FileOpener.openFile({
          path: writeResult.uri,
          mimeType: 'application/vnd.android.package-archive',
        });
      }
    } catch (error) {
      console.error('Download/Install failed:', error);
      setDownloadProgress(null);
      setIsDownloading(false);
      await Toast.show({ text: 'Could not download or install update. Please try again later.', duration: 'long' });
    }
  };

  return (
    <>
      {showPrompt && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 10000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '16px',
        }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.6)',
            backdropFilter: 'blur(4px)',
          }} onClick={() => setShowPrompt(false)} />
          
          <div style={{
            position: 'relative',
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '24px',
            padding: '24px',
            maxWidth: '360px',
            width: '100%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            textAlign: 'center',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }} className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
            <div style={{
              width: '48px',
              height: '48px',
              backgroundColor: '#ecfdf5',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto',
              color: '#059669'
            }} className="dark:bg-emerald-950/40 dark:text-emerald-450">
              <svg style={{ width: '24px', height: '24px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </div>
            <div>
              <h3 style={{
                fontSize: '16px',
                fontWeight: 900,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                margin: '0 0 8px 0',
                color: '#1e293b'
              }} className="dark:text-white">Update Available</h3>
              <p style={{
                fontSize: '12px',
                fontWeight: 500,
                lineHeight: 1.5,
                color: '#64748b',
                margin: 0
              }} className="dark:text-slate-400">
                A new version <span style={{ fontWeight: 800, color: '#0f172a' }} className="dark:text-slate-200">v{newVersion}</span> is available for Sbjiwala. Would you like to update?
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
              <button
                onClick={handleConfirmUpdate}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  border: 'none',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                className="hover:bg-emerald-500 active:scale-95 shadow-md"
              >
                Update Now
              </button>
              <button
                onClick={() => setShowPrompt(false)}
                style={{
                  flex: 1,
                  padding: '12px',
                  backgroundColor: 'transparent',
                  border: '1px solid #cbd5e1',
                  color: '#64748b',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                className="dark:border-slate-800 dark:text-slate-400 dark:hover:bg-slate-850 hover:bg-slate-50 active:scale-95"
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {downloadProgress !== null && (
        <div style={{
          position: 'fixed',
          bottom: '72px',
          left: '16px',
          right: '16px',
          zIndex: 9999,
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
          <div style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '12px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            maxWidth: '400px',
            margin: '0 auto'
          }} className="dark:bg-slate-900 dark:border-slate-800 dark:text-white">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontSize: '10px',
              fontWeight: 'bold',
              color: '#64748b'
            }} className="dark:text-slate-400">
              <span>Downloading update...</span>
              <span>{Math.round(downloadProgress)}%</span>
            </div>
            <div style={{
              width: '100%',
              backgroundColor: '#f1f5f9',
              height: '6px',
              borderRadius: '9999px',
              overflow: 'hidden'
            }} className="dark:bg-slate-800">
              <div style={{
                backgroundColor: '#10b981',
                height: '100%',
                width: `${downloadProgress}%`,
                transition: 'width 0.3s ease-out'
              }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
};
