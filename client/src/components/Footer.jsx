import { version } from '../../package.json';

const EMPRESA = 'Aruca Maquinarias C.A.';
const ANIO = new Date().getFullYear();

export default function Footer() {
  return (
    <footer className="site-footer">
      © {ANIO} {EMPRESA} - v{version}
    </footer>
  );
}
