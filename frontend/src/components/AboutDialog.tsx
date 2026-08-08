import React from 'react';
import { Dialog, Classes, H5, Text } from '@blueprintjs/core';
import logoUrl from '../assets/logo.png';

interface AboutDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutDialog: React.FC<AboutDialogProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="About qimg"
      icon="help"
      style={{ width: '90%', maxWidth: '500px' }}
    >
      <div
        className={Classes.DIALOG_BODY}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          padding: '1.5rem',
          gap: '1rem',
        }}
      >
        <img
          src={logoUrl}
          alt="qimg Logo"
          style={{ width: '180px', height: '180px', objectFit: 'contain', marginBottom: '0.5rem' }}
        />
        <H5
          style={{
            margin: 0,
            fontWeight: 'bold',
            color: 'var(--accent-primary)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          QIMG — IMAGE BROWSER
        </H5>
        <Text style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Version 1.0.0
        </Text>

        <div style={{ margin: '0.5rem 0', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <Text style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            A fast local image browser with ComfyUI and A1111 prompt inspection for PNG files.
          </Text>
        </div>

        <div
          style={{
            borderTop: '1px solid var(--border-light)',
            width: '100%',
            paddingTop: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
          }}
        >
          <Text style={{ color: 'var(--text-muted)' }}>Copyright © 2026 Mattia Moretti</Text>
          <Text style={{ color: 'var(--text-muted)' }}>Built with Go • React • BlueprintJS • TypeScript</Text>
          <Text style={{ color: 'var(--text-muted)' }}>Licensed under the MIT License</Text>
        </div>
      </div>
    </Dialog>
  );
};
