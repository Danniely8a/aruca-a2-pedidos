import { useEffect, useState } from 'react';

const DISMISS_KEY = 'a2_install_dismissed';
const UNA_SEMANA = 7 * 24 * 60 * 60 * 1000;

function ocultoRecientemente() {
  try {
    const valor = Number(localStorage.getItem(DISMISS_KEY));
    return Boolean(valor) && Date.now() - valor < UNA_SEMANA;
  } catch {
    return false;
  }
}

export default function InstallApp({ compact = false }) {
  const [prompt, setPrompt] = useState(null);
  const [ios, setIos] = useState(false);
  const [instalada, setInstalada] = useState(false);
  const [ayuda, setAyuda] = useState(false);
  const [oculto, setOculto] = useState(ocultoRecientemente);

  useEffect(() => {
    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true;
    setInstalada(Boolean(standalone));
    setIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent || ''));

    const alPrompt = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    const alInstalar = () => {
      setInstalada(true);
      setAyuda(false);
    };

    window.addEventListener('beforeinstallprompt', alPrompt);
    window.addEventListener('appinstalled', alInstalar);
    return () => {
      window.removeEventListener('beforeinstallprompt', alPrompt);
      window.removeEventListener('appinstalled', alInstalar);
    };
  }, []);

  if (instalada || oculto) return null;

  const instalar = async () => {
    if (prompt) {
      prompt.prompt();
      try {
        await prompt.userChoice;
      } catch {
        // el usuario cerró el diálogo del navegador
      }
      setPrompt(null);
      return;
    }
    setAyuda(true);
  };

  return (
    <div className="install-app">
      <button
        type="button"
        className={`btn btn-install ${compact ? 'btn-sm' : ''}`}
        onClick={instalar}
      >
        <span aria-hidden="true">⤓</span>
        Instalar app
      </button>

      {ayuda && (
        <div className="install-help">
          <strong>Instala A2 Pedidos en tu teléfono</strong>
          <p>
            {ios
              ? 'En Safari toca el botón Compartir y elige «Agregar a pantalla de inicio».'
              : 'Abre el menú del navegador y elige «Instalar aplicación» o «Agregar a pantalla de inicio».'}
          </p>
          <div className="actions">
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setAyuda(false)}
            >
              Entendido
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => {
                try {
                  localStorage.setItem(DISMISS_KEY, String(Date.now()));
                } catch {
                  // sin localStorage: se oculta solo en esta sesión
                }
                setOculto(true);
              }}
            >
              No mostrar por ahora
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
