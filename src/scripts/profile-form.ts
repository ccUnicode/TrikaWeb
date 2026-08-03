function showMessage(
  message: HTMLElement | null,
  text: string,
  ok: boolean
) {
  if (!message) return;
  message.textContent = text;
  message.classList.remove(
    'hidden',
    'bg-red-500/10',
    'text-red-500',
    'border-red-500/20',
    'bg-global-primary/10',
    'text-global-primary',
    'border-global-primary/20'
  );
  if (ok) {
    message.classList.add('bg-global-primary/10', 'text-global-primary', 'border-global-primary/20');
  } else {
    message.classList.add('bg-red-500/10', 'text-red-500', 'border-red-500/20');
  }
}

export function initProfileForm() {
  const form = document.getElementById('profile-form') as HTMLFormElement | null;
  const message = document.getElementById('profile-message');
  const saveBtn = document.getElementById('save-profile-btn') as HTMLButtonElement | null;
  const avatarInput = document.getElementById('avatar') as HTMLInputElement | null;
  const displayName = document.getElementById('profile-display-name');
  const usernameDisplay = document.getElementById('profile-username-display');
  const avatarPreview = document.getElementById('avatar-preview');

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!saveBtn) return;

    const original = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Guardando...';

    try {
      const fullName = (document.getElementById('full_name') as HTMLInputElement).value.trim();
      const usernameRaw = (document.getElementById('username') as HTMLInputElement).value.trim();

      const profileRes = await fetch('/api/profile/update', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          username: usernameRaw || null,
        }),
      });
      const profileData = await profileRes.json();
      if (!profileRes.ok) throw new Error(profileData.error || 'No se pudo guardar el perfil');

      if (avatarInput?.files?.[0]) {
        const fd = new FormData();
        fd.append('avatar', avatarInput.files[0]);
        const avatarRes = await fetch('/api/profile/avatar', { method: 'POST', body: fd });
        const avatarData = await avatarRes.json();
        if (!avatarRes.ok) throw new Error(avatarData.error || 'No se pudo subir la foto');
      }

      if (displayName) displayName.textContent = profileData.profile.full_name || 'Estudiante';

      if (profileData.profile.username) {
        if (usernameDisplay) {
          usernameDisplay.textContent = `@${profileData.profile.username}`;
          usernameDisplay.classList.remove('hidden');
        } else {
          const p = document.createElement('p');
          p.id = 'profile-username-display';
          p.className = 'text-sm text-global-primary mt-1';
          p.textContent = `@${profileData.profile.username}`;
          displayName?.parentElement?.appendChild(p);
        }
      } else if (usernameDisplay) {
        usernameDisplay.classList.add('hidden');
      }

      if (avatarInput?.files?.[0] && avatarPreview) {
        window.location.reload();
      }

      showMessage(message, 'Perfil actualizado correctamente.', true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar';
      showMessage(message, msg, false);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = original;
    }
  });
}
