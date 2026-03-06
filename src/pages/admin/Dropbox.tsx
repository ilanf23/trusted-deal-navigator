import EvanLayout from '@/components/evan/EvanLayout';
import { DropboxBrowser } from '@/components/admin/DropboxBrowser';

const Dropbox = () => {
  return (
    <EvanLayout>
      <div className="h-[calc(100vh-4rem)] -mx-4 -mb-4 sm:-mx-6 sm:-mb-6 md:-mx-8 md:-mb-8">
        <DropboxBrowser />
      </div>
    </EvanLayout>
  );
};

export default Dropbox;
