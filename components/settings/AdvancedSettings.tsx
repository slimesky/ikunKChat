import React from 'react';
import { Settings } from '../../types';
import { SettingsItem } from '../SettingsItem';
import { useLocalization } from '../../contexts/LocalizationContext';

interface AdvancedSettingsProps {
  settings: Settings;
  onSettingsChange: (newSettings: Partial<Settings>) => void;
  visibleIds: Set<string>;
}

export const AdvancedSettings: React.FC<AdvancedSettingsProps> = ({ settings, onSettingsChange, visibleIds }) => {
  const { t } = useLocalization();

  return (
    <>
      {visibleIds.has('temperature') && (
        <SettingsItem label={t('temperature')} description={t('temperatureDesc')}>
          <div className="flex items-center gap-4 w-60">
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.temperature}
              onChange={e => onSettingsChange({ temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <span className="font-mono text-sm">{settings.temperature.toFixed(1)}</span>
          </div>
        </SettingsItem>
      )}
      {visibleIds.has('contextLength') && (
        <SettingsItem label={t('contextLength')} description={t('contextLengthDesc')}>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="0"
              step="1"
              value={settings.contextLength}
              onChange={e => onSettingsChange({ contextLength: parseInt(e.target.value, 10) })}
              className="input-glass w-24"
            />
          </div>
        </SettingsItem>
      )}
    </>
  );
};
