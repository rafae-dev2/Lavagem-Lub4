import { createRoot } from 'react-dom/client';
import CentralGerencial from '../src/pages/CentralGerencial';
import '../src/index.css';
const root=document.getElementById('root');
if(!root)throw new Error('Root de teste ausente');
createRoot(root).render(<CentralGerencial />);
