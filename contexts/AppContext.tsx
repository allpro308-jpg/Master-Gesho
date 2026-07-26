import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/template';
import { Tool, Comment } from '../services/mockData';
import {
  fetchTools, fetchSavedToolIds, fetchVotedToolIds, fetchUserRatings,
  fetchComments as fetchCommentsApi, toggleSave, toggleVote, upsertRating, addCommentToDb,
} from '../services/toolsService';

interface AppContextType {
  tools: Tool[];
  savedToolIds: string[];
  votedToolIds: string[];
  userRatings: Record<string, number>;
  searchQuery: string;
  selectedCategory: string;
  loading: boolean;
  toolComments: Record<string, Comment[]>;
  setSearchQuery: (q: string) => void;
  setSelectedCategory: (c: string) => void;
  toggleSaveTool: (toolId: string) => void;
  toggleVoteTool: (toolId: string) => void;
  rateTool: (toolId: string, rating: number) => void;
  addComment: (toolId: string, text: string) => void;
  loadComments: (toolId: string) => void;
  refreshTools: () => void;
  getToolById: (id: string) => Tool | undefined;
  getTrendingTools: () => Tool[];
  getNewTools: () => Tool[];
  getTopRatedTools: () => Tool[];
  getEditorPicks: () => Tool[];
  getFeaturedTools: () => Tool[];
  getToolsByCategory: (category: string) => Tool[];
  getRecommendedTools: () => Tool[];
  getPersonalizedRecommendations: () => { tools: Tool[]; basedOn: string; groups: { tag: string; tools: Tool[] }[] };
  isToolSaved: (toolId: string) => boolean;
  isToolVoted: (toolId: string) => boolean;
  getUserRating: (toolId: string) => number;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tools, setTools] = useState<Tool[]>([]);
  const [savedToolIds, setSavedToolIds] = useState<string[]>([]);
  const [votedToolIds, setVotedToolIds] = useState<string[]>([]);
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});
  const [toolComments, setToolComments] = useState<Record<string, Comment[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');
  const [loading, setLoading] = useState(true);

  const refreshTools = useCallback(() => {
    fetchTools().then(t => setTools(t));
  }, []);

  // Load tools (public - no auth needed)
  useEffect(() => {
    fetchTools().then(t => { setTools(t); setLoading(false); });
  }, []);

  // Load user-specific data when authenticated
  useEffect(() => {
    if (!user?.id) {
      setSavedToolIds([]);
      setVotedToolIds([]);
      setUserRatings({});
      return;
    }
    Promise.all([
      fetchSavedToolIds(user.id),
      fetchVotedToolIds(user.id),
      fetchUserRatings(user.id),
    ]).then(([saved, voted, ratings]) => {
      setSavedToolIds(saved);
      setVotedToolIds(voted);
      setUserRatings(ratings);
    });
  }, [user?.id]);

  const toggleSaveTool = useCallback((toolId: string) => {
    if (!user?.id) return;
    const isSaved = savedToolIds.includes(toolId);
    setSavedToolIds(prev => isSaved ? prev.filter(id => id !== toolId) : [...prev, toolId]);
    toggleSave(user.id, toolId, isSaved);
  }, [user?.id, savedToolIds]);

  const toggleVoteTool = useCallback((toolId: string) => {
    if (!user?.id) return;
    const isVoted = votedToolIds.includes(toolId);
    setVotedToolIds(prev => isVoted ? prev.filter(id => id !== toolId) : [...prev, toolId]);
    setTools(prev => prev.map(t =>
      t.id === toolId ? { ...t, votes: isVoted ? t.votes - 1 : t.votes + 1 } : t
    ));
    toggleVote(user.id, toolId, isVoted);
  }, [user?.id, votedToolIds]);

  const rateTool = useCallback((toolId: string, rating: number) => {
    if (!user?.id) return;
    const prevRating = userRatings[toolId];
    setUserRatings(prev => ({ ...prev, [toolId]: rating }));
    setTools(prev => prev.map(t => {
      if (t.id !== toolId) return t;
      if (prevRating) {
        const totalRating = t.rating * t.ratingCount - prevRating + rating;
        return { ...t, rating: Math.round((totalRating / t.ratingCount) * 10) / 10 };
      }
      const totalRating = t.rating * t.ratingCount + rating;
      const newCount = t.ratingCount + 1;
      return { ...t, rating: Math.round((totalRating / newCount) * 10) / 10, ratingCount: newCount };
    }));
    upsertRating(user.id, toolId, rating);
  }, [user?.id, userRatings]);

  const loadComments = useCallback((toolId: string) => {
    fetchCommentsApi(toolId).then(comments => {
      setToolComments(prev => ({ ...prev, [toolId]: comments }));
    });
  }, []);

  const addComment = useCallback((toolId: string, text: string) => {
    if (!user?.id) return;
    const tempComment: Comment = {
      id: `temp_${Date.now()}`,
      userId: user.id,
      userName: user.username || user.email || 'مستخدم',
      text,
      createdAt: new Date().toISOString().split('T')[0],
    };
    setToolComments(prev => ({
      ...prev,
      [toolId]: [tempComment, ...(prev[toolId] || [])],
    }));
    addCommentToDb(user.id, toolId, text).then(() => {
      loadComments(toolId);
    });
  }, [user, loadComments]);

  const getToolById = useCallback((id: string) => tools.find(t => t.id === id), [tools]);
  const getTrendingTools = useCallback(() => [...tools].filter(t => t.trending).sort((a, b) => b.votes - a.votes), [tools]);
  const getNewTools = useCallback(() => [...tools].filter(t => t.isNew).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()), [tools]);
  const getTopRatedTools = useCallback(() => [...tools].sort((a, b) => b.rating - a.rating).slice(0, 10), [tools]);
  const getEditorPicks = useCallback(() => tools.filter(t => t.editorPick), [tools]);
  const getFeaturedTools = useCallback(() => tools.filter(t => t.featured), [tools]);
  const getToolsByCategory = useCallback((category: string) => category === 'الكل' ? tools : tools.filter(t => t.category === category), [tools]);

  const getRecommendedTools = useCallback(() => {
    const savedCategories = savedToolIds.map(id => tools.find(t => t.id === id)?.category).filter(Boolean) as string[];
    if (savedCategories.length === 0) return [...tools].sort((a, b) => b.votes * b.rating - a.votes * a.rating).slice(0, 8);
    const categoryCount: Record<string, number> = {};
    savedCategories.forEach(c => { categoryCount[c] = (categoryCount[c] || 0) + 1; });
    const topCat = Object.entries(categoryCount).sort(([, a], [, b]) => b - a)[0]?.[0];
    if (!topCat) return tools.slice(0, 8);
    return tools.filter(t => t.category === topCat && !savedToolIds.includes(t.id)).sort((a, b) => b.rating - a.rating).slice(0, 8);
  }, [tools, savedToolIds]);

  const getPersonalizedRecommendations = useCallback(() => {
    const interactedIds = [...new Set([...votedToolIds, ...savedToolIds])];
    const interactedTools = interactedIds.map(id => tools.find(t => t.id === id)).filter(Boolean) as Tool[];

    if (interactedTools.length === 0) {
      return {
        tools: [...tools].sort((a, b) => b.votes - a.votes).slice(0, 8),
        basedOn: '',
        groups: [],
      };
    }

    // ── Collect tag frequency from interacted tools ──────────────────────
    const tagScore: Record<string, number> = {};
    interactedTools.forEach(t => {
      // saved tools worth more (×2)
      const weight = savedToolIds.includes(t.id) ? 2 : 1;
      t.tags.forEach(tag => {
        tagScore[tag] = (tagScore[tag] || 0) + weight;
      });
    });

    // ── Also score categories ────────────────────────────────────────────
    const catScore: Record<string, number> = {};
    interactedTools.forEach(t => {
      const weight = savedToolIds.includes(t.id) ? 2 : 1;
      catScore[t.category] = (catScore[t.category] || 0) + weight;
    });

    const topTags = Object.entries(tagScore)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 4)
      .map(([tag]) => tag);

    const topCats = Object.entries(catScore)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([cat]) => cat);

    // ── Build per-tag groups ─────────────────────────────────────────────
    const groups: { tag: string; tools: Tool[] }[] = [];

    topTags.forEach(tag => {
      const tagTools = tools
        .filter(t => t.tags.includes(tag) && !interactedIds.includes(t.id))
        .sort((a, b) => b.rating * b.votes - a.rating * a.votes)
        .slice(0, 8);
      if (tagTools.length >= 2) groups.push({ tag, tools: tagTools });
    });

    // Fallback to category groups if not enough tag groups
    if (groups.length < 2) {
      topCats.forEach(cat => {
        const catTools = tools
          .filter(t => t.category === cat && !interactedIds.includes(t.id))
          .sort((a, b) => b.rating * b.votes - a.rating * a.votes)
          .slice(0, 8);
        if (catTools.length >= 2 && !groups.find(g => g.tag === cat)) {
          groups.push({ tag: cat, tools: catTools });
        }
      });
    }

    // ── Flat deduplicated list ───────────────────────────────────────────
    const seen = new Set<string>();
    const flatTools: Tool[] = [];
    groups.forEach(g => {
      g.tools.forEach(t => {
        if (!seen.has(t.id)) { seen.add(t.id); flatTools.push(t); }
      });
    });

    if (flatTools.length < 4) {
      const extra = tools
        .filter(t => !interactedIds.includes(t.id) && !seen.has(t.id))
        .sort((a, b) => b.votes - a.votes)
        .slice(0, 8 - flatTools.length);
      extra.forEach(t => { seen.add(t.id); flatTools.push(t); });
    }

    const basedOn = topTags[0] || topCats[0] || '';
    return { tools: flatTools, basedOn, groups };
  }, [tools, votedToolIds, savedToolIds]);

  const isToolSaved = useCallback((toolId: string) => savedToolIds.includes(toolId), [savedToolIds]);
  const isToolVoted = useCallback((toolId: string) => votedToolIds.includes(toolId), [votedToolIds]);
  const getUserRating = useCallback((toolId: string) => userRatings[toolId] || 0, [userRatings]);

  return (
    <AppContext.Provider value={{
      tools, savedToolIds, votedToolIds, userRatings, searchQuery, selectedCategory, loading, toolComments,
      setSearchQuery, setSelectedCategory, toggleSaveTool, toggleVoteTool, rateTool, addComment, loadComments,
      refreshTools,
      getToolById, getTrendingTools, getNewTools, getTopRatedTools, getEditorPicks, getFeaturedTools,
      getToolsByCategory, getRecommendedTools, getPersonalizedRecommendations, isToolSaved, isToolVoted, getUserRating,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useAppContext = () => useContext(AppContext);
