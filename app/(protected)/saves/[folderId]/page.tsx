import SavesPageClient from '@/app/components/saves/SavesPageClient';

export default async function SavesFolderPage({
  params,
}: {
  params: Promise<{ folderId: string }>;
}) {
  const { folderId } = await params;
  return <SavesPageClient folderIdFromUrl={folderId} />;
}
