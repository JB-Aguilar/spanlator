export function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

export function formatDate(dateStr) {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString()
}
