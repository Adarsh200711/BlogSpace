import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  QueryClient, QueryClientProvider, useQueryClient,
} from '@tanstack/react-query';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, BookOpen, Check, ChevronRight, Feather,
  FileText, Heart, LoaderCircle, LogOut, MessageCircle, PenLine, Plus, Search,
  Sparkles, Trash2,
} from 'lucide-react';
import {
  getGetCurrentUserQueryKey, getGetMyDashboardSummaryQueryKey, getGetPostQueryKey,
  getListCommentsQueryKey, getListMyPostsQueryKey, getListPostsQueryKey,
  useCreateComment, useCreatePost, useDeletePost, useGetCurrentUser,
  useGetMyDashboardSummary, useGetPost, useListComments, useListMyPosts,
  useListPosts, useUpdatePost,
} from '@workspace/api-client-react';
import type { Comment, Post, PostSummary } from '@workspace/api-client-react';
import { format } from 'date-fns';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Link, Redirect, Route, Switch, Router as WouterRouter, useLocation, useParams } from 'wouter';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const appearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#285f52',
    colorForeground: '#253c37',
    colorMutedForeground: '#6c817a',
    colorDanger: '#a74f45',
    colorBackground: '#fbf8f1',
    colorInput: '#fffdf8',
    colorInputForeground: '#253c37',
    colorNeutral: '#d9d4c8',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.75rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf8f1] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#253c37] font-serif',
    headerSubtitle: 'text-[#6c817a]',
    socialButtonsBlockButtonText: 'text-[#253c37] font-medium',
    formFieldLabel: 'text-[#35564d]',
    footerActionLink: 'text-[#285f52] font-semibold',
    footerActionText: 'text-[#6c817a]',
    dividerText: 'text-[#6c817a]',
    identityPreviewEditButton: 'text-[#285f52]',
    formFieldSuccessText: 'text-[#285f52]',
    alertText: 'text-[#a74f45]',
    logoBox: 'mb-2',
    logoImage: 'h-9',
    socialButtonsBlockButton: 'border-[#d9d4c8] rounded-xl',
    formButtonPrimary: 'bg-[#285f52] hover:bg-[#214c42] rounded-xl',
    formFieldInput: 'border-[#d9d4c8] rounded-xl',
    footerAction: 'border-t border-[#e6e0d4]',
    dividerLine: 'bg-[#e6e0d4]',
    alert: 'rounded-xl',
    otpCodeFieldInput: 'border-[#d9d4c8] rounded-lg',
    formFieldRow: 'mb-4',
    main: 'gap-5',
  },
};

function dateLabel(date?: string) {
  if (!date) return 'Just published';
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? 'Recently' : format(parsed, 'MMM d, yyyy');
}

function initials(name: string) {
  return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase();
}

function QueryCacheBridge() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const next = user?.id ?? null;
    if (previous.current !== undefined && previous.current !== next) client.clear();
    previous.current = next;
  }), [addListener, client]);
  return null;
}

function Shell({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();
  const current = useGetCurrentUser({
    query: { enabled: isLoaded && Boolean(isSignedIn), queryKey: getGetCurrentUserQueryKey(), retry: false },
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const logout = async () => {
    await signOut({ redirectUrl: basePath || '/' });
    queryClient.clear();
  };
  const name = current.data?.name || user?.fullName || user?.firstName || 'Writer';
  return (
    <div className="site-shell">
      <header className="topbar">
        <div className="nav-inner">
          <Link href="/" className="brand" data-testid="link-brand">
            <span className="brand-mark"><BookOpen size={18} strokeWidth={1.8} /></span>
            <span>blog<span>space</span></span>
          </Link>
          <button className="mobile-menu" onClick={() => setMobileOpen(!mobileOpen)} aria-label="Toggle navigation" data-testid="button-menu">
            <span></span><span></span>
          </button>
          <nav className={`main-nav ${mobileOpen ? 'is-open' : ''}`}>
            <Link href="/" className="nav-link" data-testid="link-home">Home</Link>
            {isSignedIn && <Link href="/discover" className="nav-link" data-testid="link-discover">Discover</Link>}
            <Link href="/posts/new" className="nav-link" data-testid="link-create">Create post</Link>
            <Link href="/my-posts" className="nav-link" data-testid="link-my-posts">My posts</Link>
          </nav>
          <div className="nav-actions">
            {isLoaded && isSignedIn ? (
              <>
                <span className="welcome-user"><span className="avatar">{initials(name)}</span><span>{name}</span></span>
                <button className="icon-button logout" onClick={logout} title="Log out" data-testid="button-logout"><LogOut size={17} /><span>Log out</span></button>
              </>
            ) : isLoaded ? (
              <>
                <Link href="/sign-in" className="signin-link" data-testid="link-login">Log in</Link>
                <Link href="/sign-up" className="button button-small" data-testid="link-register">Join the community <ArrowRight size={15} /></Link>
              </>
            ) : <span className="nav-skeleton" />}
          </div>
        </div>
      </header>
      <main>{children}</main>
      <footer className="footer">
        <Link href="/" className="footer-brand"><span className="brand-mark"><BookOpen size={16} /></span>blogspace</Link>
        <span>A little more room for good ideas.</span>
        <Link href="/posts/new" className="footer-write">Write something <ArrowDownRight size={15} /></Link>
      </footer>
      {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" />}
    </div>
  );
}

function HomeRedirect() {
  const { isSignedIn, isLoaded } = useUser();
  if (isLoaded && isSignedIn) return <Redirect to="/my-posts" />;
  return <HomePage />;
}

function LoadingBlock({ label = 'Gathering the latest stories' }: { label?: string }) {
  return <div className="loading-block" role="status"><div className="skeleton-line skeleton-title" /><div className="skeleton-line" /><div className="skeleton-line short" /><span>{label}</span></div>;
}

function QueryError({ retry, message = 'We couldn’t load this just now.' }: { retry: () => void; message?: string }) {
  return <section className="notice-card error-card"><span className="notice-icon">!</span><h3>That page took a wrong turn.</h3><p>{message}</p><button onClick={retry} className="text-button" data-testid="button-retry">Try again <ArrowRight size={15} /></button></section>;
}

function PostCard({ post, featured = false, index = 0 }: { post: PostSummary; featured?: boolean; index?: number }) {
  return (
    <article className={`post-card ${featured ? 'featured-post' : ''}`} style={{ animationDelay: `${index * 70}ms` }} data-testid={`card-post-${post.id}`}>
      <div className="post-card-top"><span className="eyebrow">{featured ? 'Editor’s pick' : 'From the community'}</span><span className="post-date">{dateLabel(post.publishedAt)}</span></div>
      <Link href={`/posts/${post.id}`} className="post-title-link" data-testid={`link-post-${post.id}`}><h2>{post.title}</h2></Link>
      <p className="post-excerpt">{post.excerpt}</p>
      <div className="post-card-bottom">
        <span className="byline"><span className="avatar avatar-small">{initials(post.authorName)}</span><span>By <strong>{post.authorName}</strong></span></span>
        <span className="comment-count"><MessageCircle size={15} /> {post.commentCount}</span>
      </div>
    </article>
  );
}

function StoryList({ data, loading, error, retry, emptyTitle = 'The page is still unwritten.', emptyText = 'Be the first to share a thought with the community.' }: {
  data?: PostSummary[]; loading: boolean; error: boolean; retry: () => void; emptyTitle?: string; emptyText?: string;
}) {
  if (loading) return <LoadingBlock />;
  if (error) return <QueryError retry={retry} />;
  if (!data?.length) return <section className="empty-card"><span className="empty-mark"><Feather size={23} /></span><h3>{emptyTitle}</h3><p>{emptyText}</p><Link className="button button-small" href="/posts/new">Write the first post <ArrowRight size={15} /></Link></section>;
  return <div className="stories-grid">{data.map((post, i) => <PostCard key={post.id} post={post} featured={i === 0} index={i} />)}</div>;
}

function HomePage() {
  const posts = useListPosts();
  const items = posts.data;
  return (
    <div className="page-wrap home-page">
      <section className="home-hero">
        <div className="hero-copy">
          <div className="overline"><span className="overline-line" /> A place for ideas to find each other</div>
          <h1>Good thoughts<br />travel <em>further.</em></h1>
          <p>BlogSpace is an open home for the things you’ve been thinking about. Read widely, write honestly, and meet people somewhere in the middle.</p>
          <div className="hero-actions"><Link href="/sign-up" className="button" data-testid="button-join">Find your voice <ArrowRight size={17} /></Link><Link href="#latest" className="quiet-link">Explore the writing <ArrowDownRight size={16} /></Link></div>
          <div className="hero-note"><span className="note-dot" /> Independent writing, shared generously.</div>
        </div>
        <div className="hero-art" aria-label="Abstract illustration of pages and ideas">
          <div className="art-ring ring-one" /><div className="art-ring ring-two" />
          <div className="art-paper paper-back"><span>notes from</span><span>the in-between</span><i /></div>
          <div className="art-paper paper-front"><span className="paper-kicker">FIELD NOTES  /  01</span><h2>On noticing<br /><em>small things</em></h2><div className="paper-lines"><i /><i /><i /></div><div className="paper-sign">A thought by Mira</div></div>
          <div className="art-stamp"><Sparkles size={18} /><span>WRITE<br />WHAT<br />MATTERS</span></div>
          <div className="art-caption">A community made<br />of many margins.</div>
        </div>
      </section>
      <section className="home-manifesto">
        <span className="manifesto-mark">“</span><p>Somewhere between a note to yourself and a letter to the world, there’s a story worth sharing.</p><span className="manifesto-byline">THE BLOGSPACE PROMISE</span>
      </section>
      <section className="latest-section" id="latest">
        <div className="section-heading"><div><span className="eyebrow">The reading room</span><h2>Fresh from the page</h2></div><span className="section-aside">Ideas, essays, and little discoveries<br />from people like you.</span></div>
        <StoryList data={items} loading={posts.isLoading} error={posts.isError} retry={() => posts.refetch()} />
        <div className="home-bottom-cta"><div><span className="eyebrow">Your turn</span><h3>There’s room for your point of view.</h3></div><Link href="/sign-up" className="button button-outline">Become a member <ArrowRight size={16} /></Link></div>
      </section>
    </div>
  );
}

function DiscoverPage() {
  const [search, setSearch] = useState('');
  const [submitted, setSubmitted] = useState('');
  const posts = useListPosts(submitted ? { search: submitted } : undefined);
  const submit = (event: FormEvent) => { event.preventDefault(); setSubmitted(search.trim()); };
  return <div className="page-wrap content-page">
    <div className="page-heading compact-heading"><div><span className="eyebrow">Open reading room</span><h1>Find a new thought.</h1><p>Follow a curiosity. See where someone else has taken it.</p></div><Link href="/posts/new" className="button button-small"><PenLine size={16} /> Write a post</Link></div>
    <form className="search-form" onSubmit={submit}><Search size={19} /><input aria-label="Search posts" placeholder="Search titles and ideas…" value={search} onChange={(e) => setSearch(e.target.value)} data-testid="input-search" /><button type="submit" className="search-submit" data-testid="button-search">Search</button></form>
    <div className="feed-label"><span>{submitted ? `Results for “${submitted}”` : 'Recently published'}</span><span>{posts.data?.length ?? '—'} stories</span></div>
    <StoryList data={posts.data} loading={posts.isLoading} error={posts.isError} retry={() => posts.refetch()} emptyTitle="No stories found just yet." emptyText="Try another search, or start a new story of your own." />
  </div>;
}

function PostPage() {
  const params = useParams<{ postId: string }>();
  const id = Number(params.postId);
  const { isSignedIn, user } = useUser();
  const client = useQueryClient();
  const postQuery = useGetPost(id);
  const commentsQuery = useListComments(id);
  const createComment = useCreateComment();
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [commentSuccess, setCommentSuccess] = useState(false);
  const post = postQuery.data;
  const owns = Boolean(user?.id && post?.authorId === user.id);
  const addComment = (event: FormEvent) => {
    event.preventDefault();
    const content = comment.trim();
    if (!content) { setCommentError('Write a little something before joining in.'); return; }
    if (content.length > 2000) { setCommentError('Keep your comment under 2,000 characters.'); return; }
    setCommentError('');
    createComment.mutate({ postId: id, data: { content } }, {
      onSuccess: () => {
        setComment('');
        setCommentSuccess(true);
        client.invalidateQueries({ queryKey: getListCommentsQueryKey(id) });
        client.invalidateQueries({ queryKey: getListPostsQueryKey() });
        client.invalidateQueries({ queryKey: getGetMyDashboardSummaryQueryKey() });
        client.invalidateQueries({ queryKey: getListMyPostsQueryKey() });
        setTimeout(() => setCommentSuccess(false), 3800);
      },
    });
  };
  if (postQuery.isLoading) return <div className="page-wrap"><LoadingBlock label="Opening the story" /></div>;
  if (postQuery.isError || !post) return <div className="page-wrap"><QueryError retry={() => postQuery.refetch()} message="This story may have moved or is not available." /></div>;
  return <div className="page-wrap article-page">
    <Link href="/discover" className="back-link"><ArrowLeft size={15} /> Back to the reading room</Link>
    <article className="article">
      <div className="article-top"><span className="eyebrow">A story from the community</span><span>{dateLabel(post.publishedAt)}</span></div>
      <h1>{post.title}</h1>
      <div className="article-byline"><span className="avatar">{initials(post.authorName)}</span><div><strong>{post.authorName}</strong><span>Published {dateLabel(post.publishedAt)}</span></div>{owns && <Link href={`/posts/${id}/edit`} className="article-edit"><PenLine size={15} /> Edit story</Link>}</div>
      <div className="article-rule" />
      <div className="article-content">{post.content.split(/\n{2,}/).map((paragraph, i) => <p key={`${i}-${paragraph.slice(0, 12)}`}>{paragraph}</p>)}</div>
      <div className="article-end"><span /><Heart size={17} /><span /></div>
    </article>
    <section className="comments-section">
      <div className="comments-heading"><div><span className="eyebrow">The conversation</span><h2>Responses <small>{commentsQuery.data?.length ?? 0}</small></h2></div><span className="comment-invite">Thoughtful notes welcome.</span></div>
      {commentsQuery.isLoading ? <LoadingBlock label="Making room for the conversation" /> : commentsQuery.isError ? <QueryError retry={() => commentsQuery.refetch()} message="We couldn’t load the responses." /> :
        commentsQuery.data?.length ? <div className="comments-list">{commentsQuery.data.map((item: Comment) => <CommentItem key={item.id} comment={item} />)}</div> : <div className="comments-empty"><MessageCircle size={19} /><span>No responses yet. You could be the first.</span></div>}
      {isSignedIn ? <form className="comment-form" onSubmit={addComment}>
        <label htmlFor="comment-input">Add your perspective</label><textarea id="comment-input" value={comment} maxLength={2000} placeholder="Make it kind, make it thoughtful…" onChange={(e) => setComment(e.target.value)} data-testid="input-comment" />
        <div className="comment-form-bottom"><div>{commentError && <span className="field-error">{commentError}</span>}{commentSuccess && <span className="success-message"><Check size={14} /> Your response is part of the conversation.</span>}{!commentError && !commentSuccess && <span className="character-count">{comment.length} / 2,000</span>}</div><button className="button button-small" type="submit" disabled={createComment.isPending} data-testid="button-comment">{createComment.isPending ? 'Adding…' : 'Add response'} <ArrowRight size={15} /></button></div>
        {createComment.isError && <p className="field-error">Your response couldn’t be saved. Please try again.</p>}
      </form> : <div className="join-conversation"><span>Have a thought to add?</span><Link href="/sign-in" className="text-button">Sign in to respond <ArrowRight size={15} /></Link></div>}
    </section>
  </div>;
}

function CommentItem({ comment }: { comment: Comment }) {
  return <article className="comment-item" data-testid={`comment-${comment.id}`}><span className="avatar avatar-small">{initials(comment.authorName)}</span><div><div className="comment-meta"><strong>{comment.authorName}</strong><span>{dateLabel(comment.createdAt)}</span></div><p>{comment.content}</p></div></article>;
}

function PostEditor({ edit = false }: { edit?: boolean }) {
  const params = useParams<{ postId?: string }>();
  const { user } = useUser();
  const id = edit ? Number(params.postId) : 0;
  const postQuery = useGetPost(id, { query: { enabled: edit && Boolean(id), queryKey: getGetPostQueryKey(id) } });
  const createPost = useCreatePost();
  const updatePost = useUpdatePost();
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<{ title?: string; content?: string }>({});
  const [notice, setNotice] = useState('');
  const initialized = useRef<number | null>(null);
  useEffect(() => {
    if (edit && postQuery.data && initialized.current !== id) {
      initialized.current = id;
      setTitle(postQuery.data.title);
      setContent(postQuery.data.content);
    }
  }, [edit, id, postQuery.data]);
  const isSaving = createPost.isPending || updatePost.isPending;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const next: { title?: string; content?: string } = {};
    if (title.trim().length < 3) next.title = 'Use at least 3 characters for your title.';
    if (title.trim().length > 160) next.title = 'Keep your title under 160 characters.';
    if (!content.trim()) next.content = 'Your story needs a little substance.';
    if (content.length > 50000) next.content = 'Your story must be under 50,000 characters.';
    setErrors(next);
    if (Object.keys(next).length) return;
    const data = { title: title.trim(), content: content.trim() };
    if (edit) {
      updatePost.mutate({ postId: id, data }, { onSuccess: (saved: Post) => {
        client.setQueryData(getGetPostQueryKey(id), saved);
        client.invalidateQueries({ queryKey: getListPostsQueryKey() });
        client.invalidateQueries({ queryKey: getListMyPostsQueryKey() });
        client.invalidateQueries({ queryKey: getGetMyDashboardSummaryQueryKey() });
        setNotice('Your changes are saved.');
        setLocation(`/posts/${saved.id}`);
      } });
    } else {
      createPost.mutate({ data }, { onSuccess: (saved: Post) => {
        client.invalidateQueries({ queryKey: getListPostsQueryKey() });
        client.invalidateQueries({ queryKey: getListMyPostsQueryKey() });
        client.invalidateQueries({ queryKey: getGetMyDashboardSummaryQueryKey() });
        setLocation(`/posts/${saved.id}`);
      } });
    }
  };
  if (edit && postQuery.isLoading) return <div className="page-wrap"><LoadingBlock label="Opening your draft" /></div>;
  if (edit && (postQuery.isError || !postQuery.data)) return <div className="page-wrap"><QueryError retry={() => postQuery.refetch()} message="We couldn’t find that story." /></div>;
  if (edit && postQuery.data && postQuery.data.authorId !== user?.id) return <Redirect to={`/posts/${id}`} />;
  return <div className="page-wrap editor-page">
    <Link href={edit ? `/posts/${id}` : '/my-posts'} className="back-link"><ArrowLeft size={15} /> {edit ? 'Back to story' : 'Back to your writing'}</Link>
    <div className="editor-intro"><span className="eyebrow">{edit ? 'A thoughtful revision' : 'A blank page, a new beginning'}</span><h1>{edit ? 'Shape your story.' : 'What’s on your mind?'}</h1><p>Write like you’re talking to someone curious. The best posts start with one honest thought.</p></div>
    <form className="editor-form" onSubmit={submit}>
      <div className="form-field"><label htmlFor="post-title">Title <span>Give your idea a clear doorway</span></label><input id="post-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} placeholder="A sentence worth following…" data-testid="input-title" aria-invalid={Boolean(errors.title)} /><div className="field-foot">{errors.title ? <span className="field-error">{errors.title}</span> : <span>At least 3 characters</span>}<span>{title.length} / 160</span></div></div>
      <div className="form-field"><label htmlFor="post-content">Your story <span>Let the thought unfold</span></label><textarea id="post-content" value={content} onChange={(e) => setContent(e.target.value)} maxLength={50000} placeholder="Start wherever the story begins…" data-testid="input-content" aria-invalid={Boolean(errors.content)} /><div className="field-foot">{errors.content ? <span className="field-error">{errors.content}</span> : <span>Paragraph breaks will be preserved</span>}<span>{content.length.toLocaleString()} / 50,000</span></div></div>
      {(createPost.isError || updatePost.isError) && <div className="form-alert">Your story couldn’t be saved. Please check your connection and try again.</div>}
      {notice && <div className="success-message"><Check size={15} /> {notice}</div>}
      <div className="editor-actions"><span><BookOpen size={15} /> Published to the BlogSpace community</span><button type="submit" className="button" disabled={isSaving} data-testid="button-save-post">{isSaving ? <><LoaderCircle size={16} className="spin" /> Saving…</> : <>{edit ? 'Save changes' : 'Publish story'} <ArrowRight size={16} /></>}</button></div>
    </form>
  </div>;
}

function AuthGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useUser();
  if (!isLoaded) return <Shell><div className="page-wrap"><LoadingBlock label="Opening your writing space" /></div></Shell>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <Shell>{children}</Shell>;
}

function MyPostsPage() {
  const { user } = useUser();
  const posts = useListMyPosts({ query: { enabled: Boolean(user), queryKey: getListMyPostsQueryKey(), retry: false } });
  const summary = useGetMyDashboardSummary({ query: { enabled: Boolean(user), queryKey: getGetMyDashboardSummaryQueryKey(), retry: false } });
  const deleteMutation = useDeletePost();
  const client = useQueryClient();
  const [deleteTarget, setDeleteTarget] = useState<PostSummary | null>(null);
  const [deleteError, setDeleteError] = useState('');
  const remove = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate({ postId: deleteTarget.id }, {
      onSuccess: () => {
        client.invalidateQueries({ queryKey: getListMyPostsQueryKey() });
        client.invalidateQueries({ queryKey: getListPostsQueryKey() });
        client.invalidateQueries({ queryKey: getGetMyDashboardSummaryQueryKey() });
        client.removeQueries({ queryKey: getListCommentsQueryKey(deleteTarget.id) });
        client.removeQueries({ queryKey: getGetPostQueryKey(deleteTarget.id) });
        setDeleteTarget(null);
      },
      onError: () => setDeleteError('The story could not be removed. Try again in a moment.'),
    });
  };
  const stats = summary.data;
  return <div className="page-wrap dashboard-page">
    <div className="dashboard-welcome"><div><span className="eyebrow">Your writing desk</span><h1>Good to see you, {user?.firstName || 'writer'}.</h1><p>Your ideas have a place here. Keep going.</p></div><Link href="/posts/new" className="button" data-testid="button-new-post"><Plus size={17} /> New story</Link></div>
    <section className="stats-row">
      <div className="stat-card"><span className="stat-icon"><FileText size={17} /></span><div><strong>{summary.isLoading ? '—' : stats?.postCount ?? 0}</strong><span>Stories published</span></div></div>
      <div className="stat-card"><span className="stat-icon"><MessageCircle size={17} /></span><div><strong>{summary.isLoading ? '—' : stats?.commentsReceived ?? 0}</strong><span>Responses received</span></div></div>
      <div className="stat-card"><span className="stat-icon"><Heart size={17} /></span><div><strong>{summary.isLoading ? '—' : stats?.commentCount ?? 0}</strong><span>Conversations joined</span></div></div>
    </section>
    {summary.isError && <div className="subtle-error"><span>We couldn’t refresh your writing totals.</span><button onClick={() => summary.refetch()} className="text-button" data-testid="button-retry-summary">Retry</button></div>}
    <section className="my-posts-section">
      <div className="section-heading dashboard-section-heading"><div><span className="eyebrow">Your published work</span><h2>Stories you’ve shared</h2></div>{posts.data && <span className="section-aside">{posts.data.length} {posts.data.length === 1 ? 'story' : 'stories'} in your collection</span>}</div>
      {posts.isLoading ? <LoadingBlock label="Setting up your writing desk" /> : posts.isError ? <QueryError retry={() => posts.refetch()} message="We couldn’t load your stories." /> : !posts.data?.length ? <section className="dashboard-empty"><div className="empty-illustration"><PenLine size={25} /></div><div><h3>Your first story starts here.</h3><p>It doesn’t need to be perfect. It just needs to be yours.</p></div><Link href="/posts/new" className="text-button">Start writing <ChevronRight size={15} /></Link></section> :
        <div className="my-post-list">{posts.data.map((post, i) => <div className="my-post-row" key={post.id} data-testid={`row-my-post-${post.id}`}><div className="post-index">0{i + 1}</div><div className="my-post-copy"><Link href={`/posts/${post.id}`} className="my-post-title">{post.title}</Link><p>{post.excerpt}</p><span>{dateLabel(post.publishedAt)} <i /> <MessageCircle size={13} /> {post.commentCount} responses</span></div><div className="my-post-actions"><Link href={`/posts/${post.id}/edit`} className="icon-action" aria-label={`Edit ${post.title}`} data-testid={`button-edit-${post.id}`}><PenLine size={16} /></Link><button className="icon-action danger-action" onClick={() => { setDeleteTarget(post); setDeleteError(''); }} aria-label={`Delete ${post.title}`} data-testid={`button-delete-${post.id}`}><Trash2 size={16} /></button><Link href={`/posts/${post.id}`} className="row-arrow" aria-label={`Read ${post.title}`}><ArrowRight size={17} /></Link></div></div>)}</div>}
    </section>
    {deleteTarget && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null); }}><section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-title"><span className="confirm-icon"><Trash2 size={19} /></span><span className="eyebrow">One last check</span><h2 id="delete-title">Remove this story?</h2><p><strong>{deleteTarget.title}</strong> will be permanently removed from your writing desk and the reading room.</p>{deleteError && <span className="field-error">{deleteError}</span>}<div className="dialog-actions"><button className="button button-quiet" onClick={() => setDeleteTarget(null)} data-testid="button-cancel-delete">Keep story</button><button className="button button-danger" onClick={remove} disabled={deleteMutation.isPending} data-testid="button-confirm-delete">{deleteMutation.isPending ? 'Removing…' : 'Remove story'} <Trash2 size={15} /></button></div></section></div>}
  </div>;
}

function SignInPage() {
  return <div className="auth-page"><div className="auth-aside"><Link className="brand auth-brand" href="/"><span className="brand-mark"><BookOpen size={18} /></span><span>blog<span>space</span></span></Link><div className="auth-note"><span className="eyebrow">The reading room is open</span><h1>Keep the conversation<br /><em>going.</em></h1><p>Your next favorite perspective may be one sign-in away.</p></div><div className="auth-aside-foot">A home for curious minds.</div></div><div className="auth-form-wrap"><div className="auth-mobile-brand"><Link className="brand" href="/"><span className="brand-mark"><BookOpen size={18} /></span><span>blog<span>space</span></span></Link></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
}
function SignUpPage() {
  return <div className="auth-page"><div className="auth-aside signup-aside"><Link className="brand auth-brand" href="/"><span className="brand-mark"><BookOpen size={18} /></span><span>blog<span>space</span></span></Link><div className="auth-note"><span className="eyebrow">A page of your own</span><h1>Make space for<br /><em>your voice.</em></h1><p>Share what you’re learning. Find the people who are listening.</p></div><div className="auth-aside-foot">Good ideas grow in good company.</div></div><div className="auth-form-wrap"><div className="auth-mobile-brand"><Link className="brand" href="/"><span className="brand-mark"><BookOpen size={18} /></span><span>blog<span>space</span></span></Link></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
}

function RouteContent() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={() => <Shell><HomeRedirect /></Shell>} />
    <Route path="/sign-in/*?" component={SignInPage} />
    <Route path="/sign-up/*?" component={SignUpPage} />
    <Route path="/discover" component={() => <AuthGate><DiscoverPage /></AuthGate>} />
    <Route path="/posts/new" component={() => <AuthGate><PostEditor /></AuthGate>} />
    <Route path="/posts/:postId/edit" component={() => <AuthGate><PostEditor edit /></AuthGate>} />
    <Route path="/posts/:postId" component={() => <Shell><PostPage /></Shell>} />
    <Route path="/my-posts" component={() => <AuthGate><MyPostsPage /></AuthGate>} />
    <Route component={NotFound} />
  </Switch></ErrorBoundary>;
}

function ProviderRoutes() {
  const [, setLocation] = useLocation();
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={appearance}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Pick up where your curiosity left off.' } }, signUp: { start: { title: 'Make yourself at home', subtitle: 'Join a community built around good ideas.' } } }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}>
    <QueryCacheBridge /><RouteContent />
  </ClerkProvider>;
}

function App() {
  return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={basePath}><ProviderRoutes /></WouterRouter><Toaster /></TooltipProvider></QueryClientProvider>;
}

export default App;
