// A stalled dev-server/network request must offer recovery instead of hiding
// the menu forever. Late completions cannot publish an expired decoded image.
export function assetDeadline<T>(load: (expired: () => boolean) => Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => { expired = true; reject(new Error('La carga de recursos tardó demasiado.')); }, 20000);
    try {
      void load(() => expired).then(value => { clearTimeout(timer); if (!expired) resolve(value); }, error => { clearTimeout(timer); if (!expired) reject(error); });
    } catch (error) { clearTimeout(timer); reject(error); }
  });
}
