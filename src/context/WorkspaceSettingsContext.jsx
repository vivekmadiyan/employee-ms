import React, { createContext, useContext, useEffect, useState } from 'react';
import { getWorkspaceSettingsApi } from '../api';
import { AuthContext } from './AuthProvider';

const defaults = { timeZone: 'UTC', aiEnabled: true };
export const WorkspaceSettingsContext = createContext({ settings: defaults });

export default function WorkspaceSettingsProvider({ children }) {
  const { currentUser } = useContext(AuthContext);
  const companyId = currentUser?.companyId;
  const [value, setValue] = useState(null);

  useEffect(() => {
    if (!companyId || !currentUser?.id) return undefined;
    let active = true;
    let sequence = 0;
    async function load() {
      const request = ++sequence;
      try {
        const settings = await getWorkspaceSettingsApi();
        if (active && request === sequence) setValue({ companyId, settings });
      } catch {
        // A backend rollout can temporarily leave the new route unavailable.
      }
    }
    load();
    window.addEventListener('ems:workspace-updated', load);
    return () => {
      active = false;
      window.removeEventListener('ems:workspace-updated', load);
    };
  }, [companyId, currentUser?.id]);

  const settings = value && value.companyId === companyId ? value.settings : defaults;
  const setSettings = next => setValue({ companyId, settings: next });
  return <WorkspaceSettingsContext.Provider value={{ settings, setSettings }}>{children}</WorkspaceSettingsContext.Provider>;
}
