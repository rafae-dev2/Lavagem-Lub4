import React from 'react';

const ORDENS_URL = 'https://ti.usinabrancoperes.com.br/ordens-pims/';

export default function GestaoOrdensManutencao() {
  return (
    <div className="flex-1 min-h-0 flex flex-col p-2 sm:p-3 lg:p-4 bg-transparent">
      <div className="flex-1 min-h-0 flex flex-col rounded-2xl overflow-hidden border border-emerald-400/20 shadow-2xl bg-transparent">
        <iframe
          src={ORDENS_URL}
          title="Gestão de Ordens Manutenção"
          className="block w-full flex-1 min-h-0 border-0"
          style={{ backgroundColor: 'transparent' }}
          // Permite o funcionamento do site, mas impede pop-ups e navegação
          // da janela principal para fora do aplicativo.
          sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-modals"
        />
      </div>
    </div>
  );
}
