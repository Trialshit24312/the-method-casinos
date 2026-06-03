import Breadcrumb from './Breadcrumb';

export default function ToolsBreadcrumb({ page }: { page: string }) {
  return (
    <Breadcrumb
      items={[
        { label: 'Tools Hub', to: '/tools' },
        { label: page },
      ]}
    />
  );
}
