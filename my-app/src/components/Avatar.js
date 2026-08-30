// Circular avatar: the user's uploaded/Telegram photo (user.avatar_url from
// /api/auth/me), or a gradient initial-letter fallback when there isn't one.
// Used in Header.js (small, header CTA) and Account.js (large, click-to-upload).
export default function Avatar({ user, size = 32, style, ...rest }) {
  const label = (user?.username || user?.email || "").trim();
  const initial = label ? label.charAt(0).toUpperCase() : "?";
  const sizeStyle = { width: size, height: size, fontSize: Math.round(size * 0.42), ...style };

  if (user?.avatar_url) {
    return <img className="nw-avatar" style={sizeStyle} src={user.avatar_url} alt="" {...rest} />;
  }
  return <span className="nw-avatar nw-avatar-fallback" style={sizeStyle} {...rest}>{initial}</span>;
}
