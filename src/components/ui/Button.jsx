const variants = {
  gold: "btn-gold",
  outlineLight: "btn-outline-light",
  outlineDark: "btn-outline-dark",
};

export default function Button({
  variant = "gold",
  children,
  className = "",
  as: Tag = "a",
  ...props
}) {
  return (
    <Tag className={`${variants[variant] || ""} ${className}`} {...props}>
      {children}
    </Tag>
  );
}
