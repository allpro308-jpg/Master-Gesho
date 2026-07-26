import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, Pressable, StyleSheet, FlatList,
  Keyboard, Animated,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { config } from '../constants/config';
import { Tool } from '../services/mockData';

interface Suggestion {
  type: 'tool' | 'category';
  label: string;
  sublabel?: string;
  icon?: string;
  color?: string;
  toolId?: string;
}

interface SearchAutocompleteProps {
  value: string;
  onChangeText: (text: string) => void;
  onSelectTool?: (toolId: string, name: string) => void;
  onSelectCategory?: (category: string) => void;
  tools: Tool[];
  placeholder?: string;
}

export default function SearchAutocomplete({
  value, onChangeText, onSelectTool, onSelectCategory, tools, placeholder = 'ابحث عن الأدوات والفئات...',
}: SearchAutocompleteProps) {
  const { theme } = useTheme();
  const [isFocused, setIsFocused] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const inputRef = useRef<TextInput>(null);
  const s = useMemo(() => createStyles(theme), [theme]);

  const categoryIconMap: Record<string, string> = {
    'كتابة بالذكاء': 'edit',
    'أدوات الصور': 'image',
    'أدوات البيانات': 'analytics',
    'أدوات المطورين': 'code',
    'أدوات مالية': 'account-balance',
    'الإنتاجية': 'task-alt',
    'التصميم': 'palette',
    'التسويق': 'campaign',
  };

  // Generate suggestions based on query
  const suggestions = useMemo((): Suggestion[] => {
    const q = value.trim().toLowerCase();
    if (!q || q.length < 1) return [];

    const results: Suggestion[] = [];

    // Category matches
    config.categories.forEach(cat => {
      if (cat.toLowerCase().includes(q)) {
        const count = tools.filter(t => t.category === cat).length;
        results.push({
          type: 'category',
          label: cat,
          sublabel: `${count} أداة`,
          icon: categoryIconMap[cat] || 'category',
          color: theme.categoryColors?.[cat] || theme.primary,
        });
      }
    });

    // Tool matches - name, tags, description
    const toolMatches = tools
      .filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.shortDescription.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.toLowerCase().includes(q))
      )
      .slice(0, 7);

    toolMatches.forEach(t => {
      // Highlight match reason
      let sublabel = t.category;
      if (t.tags.some(tag => tag.toLowerCase().includes(q))) {
        const matchedTag = t.tags.find(tag => tag.toLowerCase().includes(q));
        if (matchedTag) sublabel = `#${matchedTag}`;
      }
      results.push({
        type: 'tool',
        label: t.name,
        sublabel,
        icon: t.logoIcon,
        color: t.logoColor,
        toolId: t.id,
      });
    });

    return results.slice(0, 10);
  }, [value, tools, theme]);

  const showDropdown = isFocused && suggestions.length > 0 && value.trim().length > 0;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: showDropdown ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [showDropdown]);

  const handleSelect = useCallback((item: Suggestion) => {
    Keyboard.dismiss();
    setIsFocused(false);
    if (item.type === 'category') {
      onChangeText('');
      onSelectCategory?.(item.label);
    } else if (item.type === 'tool' && item.toolId) {
      onChangeText(item.label);
      onSelectTool?.(item.toolId, item.label);
    }
  }, [onSelectTool, onSelectCategory, onChangeText]);

  const handleClear = useCallback(() => {
    onChangeText('');
    inputRef.current?.focus();
  }, [onChangeText]);

  const renderSuggestion = ({ item, index }: { item: Suggestion; index: number }) => (
    <Pressable
      style={({ pressed }) => [
        s.suggestionItem,
        index < suggestions.length - 1 && s.suggestionBorder,
        pressed && { backgroundColor: theme.backgroundSecondary },
      ]}
      onPress={() => handleSelect(item)}
    >
      {/* Icon */}
      <View style={[s.suggestionIcon, { backgroundColor: (item.color || theme.primary) + '20' }]}>
        <MaterialIcons
          name={(item.icon || 'search') as any}
          size={16}
          color={item.color || theme.primary}
        />
      </View>

      {/* Text */}
      <View style={s.suggestionText}>
        <Text style={s.suggestionLabel} numberOfLines={1}>
          {item.label}
        </Text>
        {item.sublabel ? (
          <Text style={s.suggestionSublabel} numberOfLines={1}>
            {item.sublabel}
          </Text>
        ) : null}
      </View>

      {/* Type badge */}
      <View style={[
        s.typeBadge,
        { backgroundColor: item.type === 'category' ? theme.accent + '20' : theme.primary + '15' }
      ]}>
        <Text style={[
          s.typeBadgeText,
          { color: item.type === 'category' ? theme.accent : theme.primary }
        ]}>
          {item.type === 'category' ? 'فئة' : 'أداة'}
        </Text>
      </View>

      <MaterialIcons name="north-west" size={14} color={theme.textMuted} style={{ opacity: 0.6 }} />
    </Pressable>
  );

  return (
    <View style={s.wrapper}>
      {/* Search Input */}
      <View style={[
        s.container,
        { backgroundColor: theme.surface, borderColor: isFocused ? theme.primary : theme.border },
        isFocused && { borderColor: theme.primary },
      ]}>
        <MaterialIcons name="search" size={20} color={isFocused ? theme.primary : theme.textMuted} />
        <TextInput
          ref={inputRef}
          style={[s.input, { color: theme.textPrimary }]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textMuted}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setTimeout(() => setIsFocused(false), 150)}
          returnKeyType="search"
          textAlign="right"
          autoCorrect={false}
        />
        {value.length > 0 ? (
          <Pressable onPress={handleClear} hitSlop={10} style={s.clearBtn}>
            <View style={s.clearBtnInner}>
              <MaterialIcons name="close" size={14} color={theme.textMuted} />
            </View>
          </Pressable>
        ) : null}
      </View>

      {/* Dropdown */}
      {showDropdown ? (
        <Animated.View style={[s.dropdown, { opacity: fadeAnim, backgroundColor: theme.surface, borderColor: theme.border }]}>
          {/* Header */}
          <View style={s.dropdownHeader}>
            <MaterialIcons name="auto-awesome" size={13} color={theme.primary} />
            <Text style={s.dropdownHeaderText}>{suggestions.length} اقتراح</Text>
          </View>
          <FlatList
            data={suggestions}
            renderItem={renderSuggestion}
            keyExtractor={(item, i) => `${item.type}-${item.label}-${i}`}
            scrollEnabled={false}
            keyboardShouldPersistTaps="handled"
          />
        </Animated.View>
      ) : null}
    </View>
  );
}

const createStyles = (theme: any) => StyleSheet.create({
  wrapper: { position: 'relative', zIndex: 100 },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 48,
    borderWidth: 1.5,
    gap: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'Cairo_400Regular',
    height: '100%',
    writingDirection: 'rtl',
  },
  clearBtn: { padding: 2 },
  clearBtnInner: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: theme.border, alignItems: 'center', justifyContent: 'center',
  },
  dropdown: {
    position: 'absolute',
    top: 54,
    left: 0, right: 0,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    overflow: 'hidden',
  },
  dropdownHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.primary + '08',
  },
  dropdownHeaderText: {
    fontSize: 11,
    fontFamily: 'Cairo_500Medium',
    color: theme.primary,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 10,
  },
  suggestionBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.border + '80',
  },
  suggestionIcon: {
    width: 34, height: 34,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  suggestionText: { flex: 1 },
  suggestionLabel: {
    fontSize: 14,
    fontFamily: 'Cairo_600SemiBold',
    color: theme.textPrimary,
  },
  suggestionSublabel: {
    fontSize: 11,
    fontFamily: 'Cairo_400Regular',
    color: theme.textMuted,
    marginTop: 1,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9999,
    flexShrink: 0,
  },
  typeBadgeText: {
    fontSize: 10,
    fontFamily: 'Cairo_600SemiBold',
  },
});
