function checkFormField(input) {
  if (!input) { return false; }
  if (input.length > 255) { return false; }
  if (/[<>]/.test(input)) { return false; }
  if (input.trim().length === 0) { return false; }
  return true;
}
