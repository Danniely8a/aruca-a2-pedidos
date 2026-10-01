export default function Logo({ size = 40, className = '' }) {
  return (
    <img
      src="/logo-aruca.png"
      alt="ARUCA"
      width={size}
      style={{ width: size, height: 'auto' }}
      className={`logo ${className}`}
      draggable="false"
    />
  );
}
