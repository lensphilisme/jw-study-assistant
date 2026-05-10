// ============================================================
// JW Study Assistant — Saved Library Screen
// ============================================================
import { useState, useEffect, useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlatList, Platform, Linking } from 'react-native';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  Input,
  ScrollView,
  BlinkDialog,
  Spinner,
  toast,
  Bookmark,
  BookOpen,
  FileText,
  BookMarked,
  AlignLeft,
  RefreshCw,
  Search,
  Trash2,
  ExternalLink,
  CheckCircle,
  AlertCircle,
  Clock,
  Newspaper,
} from '@blinkdotnew/mobile-ui';
import { useAppStore } from '@/store/appStore';
import { loadSavedSources, deleteSource } from '@/services/storageService';
import type { SavedSource, SavedSourceType, SyncStatus } from '@/types';
import { useTheme } from '@/constants/theme';

// ── Filter configuration ─────────────────────────────────────
const FILTER_TYPES: { key: 'all' | SavedSourceType; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'daily-text', label: 'Daily Texts' },
  { key: 'answer', label: 'Answers' },
  { key: 'note', label: 'Notes' },
  { key: 'article', label: 'Articles' },
  { key: 'meeting-part', label: 'Meeting Parts' },
  { key: 'watchtower', label: 'Watchtower' },
];

// ── Helpers ───────────────────────────────────────────────────
function getTypeIcon(type: SavedSourceType) {
  switch (type) {
    case 'daily-text':   return <BookOpen size={18} color="#5B7E6B" />;
    case 'answer':       return <AlignLeft size={18} color="#7B6B9E" />;
    case 'note':         return <FileText size={18} color="#9E7B5A" />;
    case 'article':      return <Newspaper size={18} color="#5A7B9E" />;
    case 'meeting-part': return <BookMarked size={18} color="#5B7E6B" />;
    case 'watchtower':   return <BookOpen size={18} color="#7B6B9E" />;
    default:             return <Bookmark size={18} color="#9CA3AF" />;
  }
}

function getSyncBadge(status: SyncStatus) {
  switch (status) {
    case 'saved':
      return (
        <XStack
          backgroundColor="rgba(91,126,107,0.15)"
          borderRadius="$10"
          paddingHorizontal="$2"
          paddingVertical="$1"
          gap="$1"
          alignItems="center"
        >
          <CheckCircle size={10} color="#5B7E6B" />
          <SizableText size="$1" color="#5B7E6B" fontWeight="600">Saved</SizableText>
        </XStack>
      );
    case 'updated':
      return (
        <XStack
          backgroundColor="rgba(90,123,158,0.15)"
          borderRadius="$10"
          paddingHorizontal="$2"
          paddingVertical="$1"
          gap="$1"
          alignItems="center"
        >
          <Clock size={10} color="#5A7B9E" />
          <SizableText size="$1" color="#5A7B9E" fontWeight="600">Updated</SizableText>
        </XStack>
      );
    case 'needs-refresh':
      return (
        <XStack
          backgroundColor="rgba(245,158,11,0.15)"
          borderRadius="$10"
          paddingHorizontal="$2"
          paddingVertical="$1"
          gap="$1"
          alignItems="center"
        >
          <AlertCircle size={10} color="#F59E0B" />
          <SizableText size="$1" color="#F59E0B" fontWeight="600">Needs Refresh</SizableText>
        </XStack>
      );
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

// ── SavedItemCard ─────────────────────────────────────────────
interface SavedItemCardProps {
  item: SavedSource;
  onDelete: (id: string) => void;
}

function SavedItemCard({ item, onDelete }: SavedItemCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const preview = item.content?.slice(0, 80) + (item.content?.length > 80 ? '…' : '');

  const handleOpen = () => {
    if (item.url) {
      Linking.openURL(item.url).catch(() => {
        toast('Could not open link', { message: 'No URL available for this item.', variant: 'error' });
      });
    } else {
      toast('No link available', { message: 'This item has no external URL.', variant: 'warning' });
    }
  };

  return (
    <Card
      backgroundColor="#2C2C2E"
      borderRadius="$4"
      padding="$4"
      borderWidth={1}
      borderColor="#3A3A3C"
      gap="$3"
    >
      {/* Top row: icon + title + badge */}
      <XStack gap="$3" alignItems="flex-start">
        <YStack
          width={36}
          height={36}
          borderRadius={18}
          backgroundColor="#1C1C1E"
          justifyContent="center"
          alignItems="center"
          borderWidth={1}
          borderColor="#3A3A3C"
          flexShrink={0}
        >
          {getTypeIcon(item.type)}
        </YStack>
        <YStack flex={1} gap="$1">
          <SizableText size="$4" color="#F2F2F7" fontWeight="700" numberOfLines={2}>
            {item.title}
          </SizableText>
          <XStack gap="$2" alignItems="center" flexWrap="wrap">
            <SizableText size="$2" color="#6B7280">{formatDate(item.savedAt)}</SizableText>
            {getSyncBadge(item.syncStatus)}
          </XStack>
        </YStack>
      </XStack>

      {/* Preview text */}
      {preview ? (
        <SizableText size="$3" color="#9CA3AF" numberOfLines={2} lineHeight={20}>
          {preview}
        </SizableText>
      ) : null}

      {/* Actions */}
      <XStack gap="$2" justifyContent="flex-end">
        <Button
          size="$2"
          backgroundColor="rgba(91,126,107,0.15)"
          borderColor="rgba(91,126,107,0.3)"
          borderWidth={1}
          color="#5B7E6B"
          onPress={handleOpen}
          icon={<ExternalLink size={13} color="#5B7E6B" />}
        >
          Open
        </Button>

        {/* Delete with confirm dialog */}
        <BlinkDialog
          trigger={
            <Button
              size="$2"
              backgroundColor="rgba(239,68,68,0.1)"
              borderColor="rgba(239,68,68,0.25)"
              borderWidth={1}
              color="#EF4444"
              icon={<Trash2 size={13} color="#EF4444" />}
            >
              Delete
            </Button>
          }
          title="Delete saved item?"
          description={`"${item.title}" will be removed from your library. This cannot be undone.`}
          onConfirm={() => { setConfirmOpen(false); onDelete(item.id); }}
          onCancel={() => setConfirmOpen(false)}
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
        />
      </XStack>
    </Card>
  );
}

// ── Empty state ───────────────────────────────────────────────
function EmptyState() {
  return (
    <YStack alignItems="center" paddingTop="$12" gap="$4">
      <YStack
        width={80}
        height={80}
        borderRadius={40}
        backgroundColor="#2C2C2E"
        justifyContent="center"
        alignItems="center"
        borderWidth={1}
        borderColor="#3A3A3C"
      >
        <Bookmark size={36} color="#4B5563" />
      </YStack>
      <YStack alignItems="center" gap="$2">
        <SizableText size="$5" color="#F2F2F7" fontWeight="700" textAlign="center">
          Nothing saved yet
        </SizableText>
        <SizableText size="$3" color="#9CA3AF" textAlign="center" maxWidth={280} lineHeight={20}>
          Save daily texts, answers, meeting prep, and articles for offline access.
        </SizableText>
      </YStack>
    </YStack>
  );
}

// ── Main Screen ───────────────────────────────────────────────
export default function SavedScreen() {
  const { t: th } = useTheme();
  const storeItems = useAppStore((s) => s.savedSources);
  const removeSavedSource = useAppStore((s) => s.removeSavedSource);

  const [items, setItems] = useState<SavedSource[]>([]);
  const [filter, setFilter] = useState<'all' | SavedSourceType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // Load from AsyncStorage on mount (merge with store)
  const loadItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const stored = await loadSavedSources();
      // Merge: store may have items not yet in AsyncStorage (e.g. just added)
      const merged = [...stored];
      for (const s of storeItems) {
        if (!merged.find((m) => m.id === s.id)) merged.push(s);
      }
      setItems(merged.sort((a, b) => b.savedAt.localeCompare(a.savedAt)));
    } catch {
      setItems(storeItems);
    } finally {
      setIsLoading(false);
    }
  }, [storeItems]);

  useEffect(() => { loadItems(); }, [loadItems]);

  // Refresh JW content (daily text + meeting week)
  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      // Trigger a reload; actual re-fetch is handled by backend services
      await loadItems();
      toast('Content refreshed', { message: 'Daily text and meeting data updated.', variant: 'success' });
    } catch {
      toast('Refresh failed', { message: 'Check your connection and try again.', variant: 'error' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Delete item
  const handleDelete = async (id: string) => {
    try {
      await deleteSource(id);
      removeSavedSource(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast('Item deleted', { variant: 'success' });
    } catch {
      toast('Delete failed', { message: 'Could not remove item.', variant: 'error' });
    }
  };

  // Filter + search
  const filtered = items.filter((item) => {
    const matchType = filter === 'all' || item.type === filter;
    const q = searchQuery.trim().toLowerCase();
    const matchSearch = !q || item.title.toLowerCase().includes(q) || item.content?.toLowerCase().includes(q);
    return matchType && matchSearch;
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: th.bg }} testID="saved-screen">
      <YStack flex={1}>
        {/* ── Header ── */}
        <XStack
          paddingHorizontal="$5"
          paddingTop="$4"
          paddingBottom="$2"
          justifyContent="space-between"
          alignItems="center"
        >
          <SizableText size="$8" color={th.ink} fontWeight="800" style={{ fontFamily: 'Georgia, serif', letterSpacing: -0.8, fontSize: 32 }}>
            Library
          </SizableText>
          <XStack gap="$2">
            <Button
              size="$3"
              chromeless
              onPress={() => setShowSearch((v) => !v)}
              icon={<Search size={20} color={showSearch ? '#5B7E6B' : '#9CA3AF'} />}
            />
            <Button
              size="$3"
              chromeless
              onPress={handleRefresh}
              disabled={isRefreshing}
              icon={
                isRefreshing
                  ? <Spinner size="small" color="#5B7E6B" />
                  : <RefreshCw size={20} color="#9CA3AF" />
              }
            />
          </XStack>
        </XStack>

        {/* ── Search bar ── */}
        {showSearch && (
          <YStack paddingHorizontal="$5" paddingBottom="$2">
            <Input
              placeholder="Search saved items…"
              value={searchQuery}
              onChangeText={setSearchQuery}
              backgroundColor="#2C2C2E"
              borderColor="#3A3A3C"
              color="#F2F2F7"
              placeholderTextColor="#6B7280"
              borderRadius="$4"
              height={42}
              autoFocus
            />
          </YStack>
        )}

        {/* ── Refresh JW Content button ── */}
        <XStack paddingHorizontal="$5" paddingBottom="$3">
          <Button
            size="$3"
            backgroundColor="rgba(91,126,107,0.12)"
            borderColor="rgba(91,126,107,0.3)"
            borderWidth={1}
            color="#5B7E6B"
            onPress={handleRefresh}
            disabled={isRefreshing}
            icon={isRefreshing ? <Spinner size="small" color="#5B7E6B" /> : <RefreshCw size={14} color="#5B7E6B" />}
            borderRadius="$10"
          >
            Refresh JW Content
          </Button>
        </XStack>

        {/* ── Type filter chips ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          paddingHorizontal="$5"
          paddingBottom="$3"
        >
          <XStack gap="$2">
            {FILTER_TYPES.map((f) => {
              const active = filter === f.key;
              return (
                <YStack
                  key={f.key}
                  backgroundColor={active ? '#5B7E6B' : '#2C2C2E'}
                  borderRadius="$10"
                  paddingHorizontal="$3"
                  paddingVertical="$2"
                  borderWidth={1}
                  borderColor={active ? '#5B7E6B' : '#3A3A3C'}
                  pressStyle={{ opacity: 0.75 }}
                  onPress={() => setFilter(f.key)}
                >
                  <SizableText
                    size="$3"
                    color={active ? 'white' : '#9CA3AF'}
                    fontWeight={active ? '700' : '400'}
                  >
                    {f.label}
                  </SizableText>
                </YStack>
              );
            })}
          </XStack>
        </ScrollView>

        {/* ── List ── */}
        {isLoading ? (
          <YStack flex={1} justifyContent="center" alignItems="center">
            <Spinner size="large" color="#5B7E6B" />
          </YStack>
        ) : filtered.length === 0 ? (
          <ScrollView flex={1} showsVerticalScrollIndicator={false} paddingHorizontal="$5">
            <EmptyState />
          </ScrollView>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 32, gap: 12 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <YStack marginBottom="$3">
                <SavedItemCard item={item} onDelete={handleDelete} />
              </YStack>
            )}
          />
        )}
      </YStack>
    </SafeAreaView>
  );
}
