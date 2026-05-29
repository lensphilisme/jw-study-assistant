import React from 'react';
import { Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  YStack,
  XStack,
  SizableText,
  Card,
  Button,
  ScrollView,
  Spinner,
  Sheet,
  Separator,
  Input,
  SearchBar as BlinkSearchBar,
} from '@blinkdotnew/mobile-ui';
import { usePremiumTheme } from '@/hooks/usePremiumTheme';
import { premiumRadii, premiumType } from '@/constants/premiumTheme';
import type { PremiumTheme } from '@/constants/premiumTheme';

export function AppScreen({
  children,
  scroll = false,
  padded = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  padded?: boolean;
}) {
  const t = usePremiumTheme();
  const content = (
    <YStack flex={1} width="100%" maxWidth={920} alignSelf="center" padding={padded ? '$5' : undefined} gap={padded ? '$5' : undefined}>
      {children}
    </YStack>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.bg }}>
      <LinearGradient colors={t.heroGradient as any} style={{ position: 'absolute', inset: 0 }} />
      <YStack position="absolute" top={-130} right={-110} width={280} height={280} borderRadius={140} backgroundColor={t.glowBlue} opacity={0.55} />
      <YStack position="absolute" bottom={-170} left={-120} width={340} height={340} borderRadius={170} backgroundColor={t.glow} opacity={0.42} />
      {scroll ? <ScrollView flex={1} showsVerticalScrollIndicator={false}>{content}</ScrollView> : content}
    </SafeAreaView>
  );
}

export function PremiumCard({
  children,
  padded = true,
  glow = false,
  onPress,
}: {
  children: React.ReactNode;
  padded?: boolean;
  glow?: boolean;
  onPress?: () => void;
}) {
  const t = usePremiumTheme();
  return (
    <Card
      backgroundColor={t.surface}
      borderRadius="$8"
      padding={padded ? '$4' : undefined}
      borderWidth={1}
      borderColor={glow ? t.borderStrong : t.border}
      gap="$3.5"
      onPress={onPress}
      pressStyle={onPress ? { opacity: 0.86, scale: 0.995 } : undefined}
      style={Platform.select({ web: { boxShadow: `0 18px 48px ${t.cardShadow}` } as any, default: undefined })}
    >
      {children}
    </Card>
  );
}

export function AppHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  const t = usePremiumTheme();
  return (
    <XStack alignItems="center" justifyContent="space-between" gap="$4">
      <YStack flex={1} gap="$1.5">
        <SizableText color={t.primary} {...premiumType.eyebrow}>JW STUDY ASSISTANT</SizableText>
        <SizableText color={t.text} {...premiumType.title}>{title}</SizableText>
        {subtitle ? <SizableText size="$3" color={t.textMuted} lineHeight={22}>{subtitle}</SizableText> : null}
      </YStack>
      {right}
    </XStack>
  );
}

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const t = usePremiumTheme();
  return (
    <YStack gap="$1" paddingHorizontal="$1">
      <SizableText size="$2" color={t.primary} fontWeight="900" letterSpacing={1.2}>{title.toUpperCase()}</SizableText>
      {subtitle ? <SizableText size="$3" color={t.textMuted}>{subtitle}</SizableText> : null}
    </YStack>
  );
}

export function GradientButton({
  children,
  onPress,
  disabled,
  icon,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  disabled?: boolean;
  icon?: React.ReactNode;
}) {
  const t = usePremiumTheme();
  return (
    <YStack borderRadius="$6" overflow="hidden" opacity={disabled ? 0.55 : 1}>
      <LinearGradient colors={t.buttonGradient as any} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
        <Button
          size="$4"
          minHeight={48}
          borderRadius="$6"
          color="white"
          backgroundColor="transparent"
          disabled={disabled}
          onPress={onPress}
          icon={icon as any}
          pressStyle={{ opacity: 0.82, scale: 0.99 }}
        >
          {children}
        </Button>
      </LinearGradient>
    </YStack>
  );
}

export function PremiumSearchBar(props: React.ComponentProps<typeof BlinkSearchBar>) {
  const t = usePremiumTheme();
  return (
    <YStack backgroundColor={t.surface} borderColor={t.borderStrong} borderWidth={1} borderRadius="$7" overflow="hidden" minHeight={50}>
      <BlinkSearchBar {...props} />
    </YStack>
  );
}

export function SearchBar({
  value,
  onChangeText,
  placeholder,
  onSubmitEditing,
}: {
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  onSubmitEditing?: () => void;
}) {
  const t = usePremiumTheme();
  return (
    <XStack alignItems="center" gap="$2" backgroundColor={t.surface} borderColor={t.borderStrong} borderWidth={1} borderRadius="$7" paddingHorizontal="$4" minHeight={52}>
      <SizableText color={t.textMuted} fontSize={18}>⌕</SizableText>
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        color={t.text}
        backgroundColor="transparent"
        borderWidth={0}
        flex={1}
        size="$4"
        focusStyle={{ borderWidth: 0, outlineWidth: 0 }}
        onSubmitEditing={onSubmitEditing}
        returnKeyType="search"
      />
    </XStack>
  );
}

export function EmptyState({ icon, title, subtitle, action }: { icon?: React.ReactNode; title: string; subtitle?: string; action?: React.ReactNode }) {
  const t = usePremiumTheme();
  return (
    <YStack alignItems="center" justifyContent="center" gap="$4" padding="$6">
      {icon ? <YStack width={86} height={86} borderRadius={43} backgroundColor={t.glowBlue} alignItems="center" justifyContent="center" borderWidth={1} borderColor={t.border}>{icon}</YStack> : null}
      <YStack alignItems="center" gap="$2">
        <SizableText size="$6" color={t.text} fontWeight="900" textAlign="center">{title}</SizableText>
        {subtitle ? <SizableText size="$3" color={t.textMuted} textAlign="center" lineHeight={22} maxWidth={320}>{subtitle}</SizableText> : null}
      </YStack>
      {action}
    </YStack>
  );
}

export function LoadingState({ label }: { label: string }) {
  const t = usePremiumTheme();
  return (
    <PremiumCard>
      <XStack gap="$3" alignItems="center">
        <Spinner size="small" color={t.primary} />
        <SizableText color={t.textMuted}>{label}</SizableText>
      </XStack>
    </PremiumCard>
  );
}

export function SettingsRow({ icon, label, value, onPress, danger = false }: { icon: React.ReactNode; label: string; value?: string; onPress?: () => void; danger?: boolean }) {
  const t = usePremiumTheme();
  return (
    <YStack>
      <XStack padding="$4" alignItems="center" gap="$3" onPress={onPress} pressStyle={{ opacity: 0.72 }}>
        <YStack width={34} height={34} borderRadius={17} backgroundColor={danger ? 'rgba(239,68,68,0.13)' : t.glowBlue} alignItems="center" justifyContent="center">{icon}</YStack>
        <SizableText size="$4" color={danger ? t.rose : t.text} fontWeight="700" flex={1}>{label}</SizableText>
        {value ? <SizableText size="$3" color={t.textMuted}>{value}</SizableText> : null}
      </XStack>
      <Separator borderColor={t.border} marginLeft={62} />
    </YStack>
  );
}

export function ThemeToggle({ value, onChange }: { value: 'dark' | 'light' | 'system'; onChange: (v: 'dark' | 'light' | 'system') => void }) {
  const t = usePremiumTheme();
  const options: Array<'dark' | 'light' | 'system'> = ['dark', 'light', 'system'];
  return (
    <XStack gap="$2">
      {options.map((item) => {
        const active = value === item;
        return (
          <YStack key={item} flex={1} borderRadius="$6" padding="$3" alignItems="center" backgroundColor={active ? t.primaryDeep : t.surface2} borderWidth={1} borderColor={active ? t.primary : t.border} onPress={() => onChange(item)} pressStyle={{ opacity: 0.8 }}>
            <SizableText size="$3" color={active ? 'white' : t.textMuted} fontWeight="900">{item[0].toUpperCase() + item.slice(1)}</SizableText>
          </YStack>
        );
      })}
    </XStack>
  );
}

export function ContentCard({ title, subtitle, children, icon, action, onPress }: { title?: string; subtitle?: string; children?: React.ReactNode; icon?: React.ReactNode; action?: React.ReactNode; onPress?: () => void }) {
  const t = usePremiumTheme();
  return (
    <PremiumCard glow={Boolean(onPress)} onPress={onPress}>
      {(title || subtitle || icon || action) ? (
        <XStack gap="$3" alignItems="flex-start">
          {icon ? <YStack width={42} height={42} borderRadius={21} backgroundColor={t.glow} alignItems="center" justifyContent="center" borderWidth={1} borderColor={t.border}>{icon}</YStack> : null}
          <YStack flex={1} gap="$1">
            {title ? <SizableText size="$5" color={t.text} fontWeight="900" lineHeight={25}>{title}</SizableText> : null}
            {subtitle ? <SizableText size="$3" color={t.textMuted} lineHeight={20}>{subtitle}</SizableText> : null}
          </YStack>
          {action}
        </XStack>
      ) : null}
      {children}
    </PremiumCard>
  );
}

export function PremiumBadge({ children, tone = 'primary' }: { children: React.ReactNode; tone?: 'primary' | 'accent' | 'gold' | 'danger' | 'muted' }) {
  const t = usePremiumTheme();
  const color = tone === 'accent' ? t.accent : tone === 'gold' ? t.gold : tone === 'danger' ? t.danger : tone === 'muted' ? t.textMuted : t.primary;
  const bg = tone === 'accent' ? t.glowBlue : tone === 'gold' ? 'rgba(245,204,114,0.14)' : tone === 'danger' ? 'rgba(249,112,125,0.14)' : t.glow;
  return (
    <YStack paddingHorizontal="$3" paddingVertical="$1.5" borderRadius={premiumRadii.pill} backgroundColor={bg} borderWidth={1} borderColor={t.border}>
      <SizableText size="$1" color={color} fontWeight="900" letterSpacing={0.7}>{children}</SizableText>
    </YStack>
  );
}

export function ReferenceLink({ children, onPress, kind = 'bible' }: { children: React.ReactNode; onPress?: () => void; kind?: 'bible' | 'publication' | 'crossref' | 'footnote' }) {
  const t = usePremiumTheme();
  const color = kind === 'bible' || kind === 'crossref' ? t.primary : t.accent;
  return (
    <SizableText
      size="$3"
      color={color}
      lineHeight={24}
      fontWeight="800"
      textDecorationLine="underline"
      onPress={onPress}
      pressStyle={{ opacity: 0.68 }}
    >
      {children}
    </SizableText>
  );
}

export function PreviewModal({ open, onClose, title, label, loading, children }: { open: boolean; onClose: () => void; title?: string; label?: string; loading?: boolean; children: React.ReactNode }) {
  const t = usePremiumTheme();
  return (
    <Sheet open={open} onOpenChange={(v: boolean) => { if (!v) onClose(); }} snapPoints={[82]} modal dismissOnSnapToBottom animation="quick">
      <Sheet.Overlay backgroundColor={t.mode === 'dark' ? 'rgba(0,0,0,0.45)' : 'rgba(24,33,47,0.18)'} />
      <Sheet.Frame backgroundColor="transparent" borderTopLeftRadius="$9" borderTopRightRadius="$9" overflow="hidden">
        <BlurView intensity={Platform.OS === 'web' ? 28 : 42} tint={t.mode === 'dark' ? 'dark' : 'light'} style={{ flex: 1 }}>
          <YStack flex={1} backgroundColor={t.mode === 'dark' ? 'rgba(10,15,25,0.90)' : 'rgba(255,253,248,0.92)'} borderTopWidth={1} borderColor={t.borderStrong}>
            <Sheet.Handle backgroundColor={t.borderStrong} />
            <ScrollView flex={1} showsVerticalScrollIndicator={false}>
              <YStack padding="$5" gap="$4">
                <XStack justifyContent="space-between" alignItems="flex-start" gap="$3">
                  <YStack flex={1} gap="$2">
                    {label ? <SizableText size="$2" color={t.primary} fontWeight="900" letterSpacing={1.2}>{label.toUpperCase()}</SizableText> : null}
                    {title ? <SizableText size="$7" color={t.text} fontWeight="900" letterSpacing={-0.5} lineHeight={31}>{title}</SizableText> : null}
                  </YStack>
                  <Button circular size="$3" backgroundColor={t.surface2} color={t.textMuted} onPress={onClose}>×</Button>
                </XStack>
                {loading ? <LoadingState label="Loading preview..." /> : children}
              </YStack>
            </ScrollView>
          </YStack>
        </BlurView>
      </Sheet.Frame>
    </Sheet>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  const t = usePremiumTheme();
  return (
    <XStack alignItems="center" justifyContent="space-between" paddingVertical="$2">
      <YStack flex={1} gap="$1">
        <SizableText fontSize={30} fontWeight="900" color={t.text} letterSpacing={-0.5}>{title}</SizableText>
        {subtitle && <SizableText size="$3" color={t.textMuted}>{subtitle}</SizableText>}
      </YStack>
      {action}
    </XStack>
  );
}

export function StatCard({ value, label, color }: { value: string | number; label: string; color?: string }) {
  const t = usePremiumTheme();
  return (
    <YStack
      flex={1}
      backgroundColor={t.surface}
      borderRadius="$5"
      padding="$3"
      borderWidth={1}
      borderColor={t.border}
      alignItems="center"
      gap="$1"
    >
      <SizableText fontSize={24} fontWeight="900" color={color || t.text}>{value}</SizableText>
      <SizableText size="$1" color={t.textMuted} textAlign="center" numberOfLines={2}>{label}</SizableText>
    </YStack>
  );
}

export function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const t = usePremiumTheme();
  return (
    <YStack
      backgroundColor={active ? t.primary : t.surface}
      borderRadius="$10"
      paddingHorizontal="$3"
      paddingVertical="$2"
      borderWidth={1}
      borderColor={active ? t.primary : t.border}
      pressStyle={{ opacity: 0.75 }}
      onPress={onPress}
    >
      <SizableText size="$3" color={active ? 'white' : t.textMuted} fontWeight={active ? '700' : '500'}>
        {label}
      </SizableText>
    </YStack>
  );
}

export type { PremiumTheme };
