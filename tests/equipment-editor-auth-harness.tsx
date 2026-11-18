import React from 'react';
import { createRoot } from 'react-dom/client';
import EquipmentImageManager from '../src/components/EquipmentImageManager';
import '../src/index.css';

function Harness() {
  return <main style={{ padding: 20, maxWidth: 1100, margin: 'auto' }}>
    <h1>Auth do editor — mock browser</h1>
    <p>Dados locais; nenhum e-mail, banco ou token real é usado.</p>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
      <button onClick={() => { (globalThis as any).__equipmentEditorAuthMock.mode = 'invalid'; }}>Mock inválido</button>
      <button onClick={() => { (globalThis as any).__equipmentEditorAuthMock.mode = 'expired'; }}>Mock expirado</button>
      <button onClick={() => { (globalThis as any).__equipmentEditorAuthMock.mode = 'success'; (globalThis as any).__equipmentEditorAuthMock.permission = false; }}>Mock sucesso sem permissão</button>
      <button onClick={() => { (globalThis as any).__equipmentEditorAuthMock.mode = 'success'; (globalThis as any).__equipmentEditorAuthMock.permission = true; }}>Mock sucesso autorizado</button>
    </div>
    <EquipmentImageManager />
  </main>;
}

createRoot(document.getElementById('root')!).render(<Harness />);
