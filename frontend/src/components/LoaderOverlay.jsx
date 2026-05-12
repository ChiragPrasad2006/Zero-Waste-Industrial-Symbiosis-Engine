export default function LoaderOverlay({ visible, label = 'Building circular connections...' }) {
  if (!visible) {
    return null;
  }

  return (
    <div className="loader-overlay">
      <div className="loader-core">
        <div className="loader-rings">
          <span />
          <span />
          <span />
        </div>
        <p>{label}</p>
      </div>
    </div>
  );
}

