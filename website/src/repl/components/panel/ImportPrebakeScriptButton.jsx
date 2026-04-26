import { errorLogger } from '@strudel/core';
import { storePrebakeScript } from '../../../settings.mjs';
import { confirmDialog } from '@src/repl/util.mjs';

async function importScript(script, updateEditor) {
  const reader = new FileReader();
  reader.readAsText(script);

  reader.onload = () => {
    const text = reader.result;
    storePrebakeScript(text);
    updateEditor && updateEditor(text);
  };

  reader.onerror = () => {
    errorLogger(new Error('failed to import prebake script'), 'importScript');
  };
}

export async function exportScript(script) {
  const blob = new Blob([script], { type: 'application/javascript' });
  const downloadLink = document.createElement('a');
  downloadLink.href = window.URL.createObjectURL(blob);
  const date = new Date().toISOString().split('T')[0];
  downloadLink.download = `prebake_${date}.strudel`;
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}

export function ImportPrebakeScriptButton({ updateEditor }) {
  const handleChange = async (e) => {
    const file = e.target.files[0];
    const confirmed = await confirmDialog('Warning: This will overwrite the current prebake.\nContinue?');
    if (!confirmed) {
      return;
    }
    try {
      await importScript(file, updateEditor);
    } catch (e) {
      errorLogger(e);
    }
  };
  return (
    <label className="space-x-1 inline-flex items-center cursor-pointer">
      <input type="file" accept=".strudel,.js" className="sr-only peer" onChange={handleChange} />
      <span className="inline-flex items-center peer-hover:opacity-50 text-xs max-w-[300px]">import</span>
    </label>
  );
}
