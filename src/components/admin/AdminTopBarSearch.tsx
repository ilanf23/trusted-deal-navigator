import type { ChangeEvent } from 'react';

interface AdminTopBarSearchProps {
  value: string;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
}

const AdminTopBarSearch = ({
  value,
  onChange,
  placeholder = 'Search by name, email, domain or phone number',
}: AdminTopBarSearchProps) => {
  return (
    <input
      type="text"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      style={{ backgroundColor: '#d5d8dd', borderRadius: 9999 }}
      className="w-full h-10 px-5 border-0 text-base text-foreground placeholder:text-[#9aa0a6] dark:placeholder:text-muted-foreground/60 focus:outline-none focus:ring-0 transition-colors"
    />
  );
};

export default AdminTopBarSearch;
