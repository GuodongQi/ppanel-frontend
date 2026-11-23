// Copies text without putting the string into a DOM text node. iOS Safari's
// data detectors turn a selected URL text node into a link and follow it on
// the same tap, which opens the subscription document as subscribe.txt.
export async function copyText(text: string): Promise<boolean> {
  if (typeof document === "undefined") {
    return false;
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // The async clipboard API can reject inside a gesture; fall through.
    }
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.top = "0";
  area.style.left = "0";
  area.style.opacity = "0";
  area.style.pointerEvents = "none";
  document.body.appendChild(area);
  area.focus();
  area.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  }
  document.body.removeChild(area);
  return copied;
}
