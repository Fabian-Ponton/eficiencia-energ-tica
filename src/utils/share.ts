export type Delivery = 'compartido' | 'descargado' | 'cancelado';

/** En el celular abre el menú de compartir (WhatsApp, Drive, correo, Archivos); en el PC descarga el archivo. */
export async function deliverFile(blob: Blob, fileName: string): Promise<Delivery> {
  const touch = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  if (touch && typeof navigator.share === 'function') {
    const file = new File([blob], fileName, { type: blob.type || 'application/octet-stream' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: fileName });
        return 'compartido';
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return 'cancelado';
        // Sin permiso para compartir (por ejemplo, si preparar el archivo tardó): se descarga
      }
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
  return 'descargado';
}
