import { useState } from 'react';

export default function ProfileModal({ user, onClose, onSave }) {
  const [form, setForm] = useState({
    username: user.username,
    email: user.email,
    bio: user.bio || '',
    location: user.location || '',
    profileImage: user.profileImage || '',
    currentPassword: '',
    newPassword: ''
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setForm((prev) => ({ ...prev, profileImage: String(reader.result || '') }));
    reader.readAsDataURL(file);
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <form className="modal-card" onSubmit={submit}>
        <h3>Edit Profile</h3>
        <input placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
        <input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
        <input placeholder="Profile image URL or data URL" value={form.profileImage} onChange={(e) => setForm({ ...form, profileImage: e.target.value })} />
        <input type="file" accept="image/*" onChange={handleImage} />
        <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
        <textarea placeholder="Bio" rows="3" value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
        <input type="password" placeholder="Current password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} required />
        <input type="password" placeholder="New password (optional)" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
        {error && <p className="error-text">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="ghost-btn" onClick={onClose}>
            Cancel
          </button>
          <button disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </div>
  );
}
