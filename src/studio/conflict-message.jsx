import React from "react";

export function StudioConflictMessage({projectName, onKeepCopy, onLoadLatest}) {
  return (
    <div className="studio-conflict-message" role="alert">
      <p><strong>{projectName}</strong> changed in another tab or was edited by someone else. Your edits are kept on this device. Keep them as a separate copy, or load the latest version and retain your edits for recovery.</p>
      <div className="studio-conflict-actions">
        <button className="studio-button is-secondary" onClick={onKeepCopy}>Keep my changes as a copy</button>
        <button className="studio-button is-secondary" onClick={onLoadLatest}>Load latest</button>
      </div>
    </div>
  );
}
