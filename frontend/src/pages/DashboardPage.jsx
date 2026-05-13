import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useDelayedLoading } from '../hooks/useDelayedLoading.js';
import LoaderOverlay from '../components/LoaderOverlay.jsx';
import GraphView from '../components/GraphView.jsx';
import PostCard from '../components/PostCard.jsx';
import ProfileModal from '../components/ProfileModal.jsx';

const initialPostForm = {
  category: 'Excess Heat',
  title: '',
  description: '',
  purpose: '',
  priceMin: '',
  quantityValue: '',
  quantityUnit: 'kg',
  imageUrl: ''
};

const initialCategoryRequest = {
  name: '',
  description: ''
};

const Avatar = ({ user, className = '' }) => (
  <div className={`avatar-shell ${className}`.trim()}>
    {user?.profileImage ? <img src={user.profileImage} alt={user?.username} /> : <span>{user?.username?.[0]?.toUpperCase() || 'U'}</span>}
  </div>
);

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user, syncUser, logout, setUser, pendingUpgrade, setPendingUpgrade } = useAuth();
  const [activeTab, setActiveTab] = useState('marketplace');
  const [posts, setPosts] = useState([]);
  const [myPosts, setMyPosts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [graph, setGraph] = useState({ nodes: [], links: [] });
  const [conversations, setConversations] = useState([]);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [priceMinFilter, setPriceMinFilter] = useState('');
  const [priceMaxFilter, setPriceMaxFilter] = useState('');
  const [dateAdded, setDateAdded] = useState('');
  const [sortBy, setSortBy] = useState('newest');
  const [postForm, setPostForm] = useState(initialPostForm);
  const [categoryRequestForm, setCategoryRequestForm] = useState(initialCategoryRequest);
  const [upgradeForm, setUpgradeForm] = useState({ paymentReference: '', months: 1 });
  const [adminData, setAdminData] = useState({ pendingPosts: [], requests: [], users: [], pendingCategories: [] });
  const [profileOpen, setProfileOpen] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [paymentChecks, setPaymentChecks] = useState({});
  const showLoader = useDelayedLoading(loading || saving, 1200);

  const superiorActive = user?.role === 'admin' || user?.isSuperiorActive;

  const fetchMarketplace = async () => {
    const query = new URLSearchParams({ status: 'approved' });

    if (search) {
      query.set('search', search);
    }
    if (category) {
      query.set('category', category);
    }
    if (priceMinFilter !== '') {
      query.set('minPrice', priceMinFilter);
    }
    if (priceMaxFilter !== '') {
      query.set('maxPrice', priceMaxFilter);
    }
    if (dateAdded) {
      query.set('dateAdded', dateAdded);
    }
    if (sortBy) {
      query.set('sort', sortBy);
    }

    const [postsData, categoryData, graphData] = await Promise.all([api(`/posts?${query.toString()}`), api('/posts/categories'), api('/graph')]);
    setPosts(postsData.posts);
    setCategories(categoryData.categories);
    setGraph(graphData);
  };

  const fetchMyArea = async () => {
    const [mine, chatData] = await Promise.all([api('/posts/mine'), api('/chat/conversations')]);
    setMyPosts(mine.posts);
    setConversations(chatData.conversations);
  };

  const fetchAdmin = async () => {
    if (user?.role !== 'admin') {
      return;
    }

    const data = await api('/admin/dashboard');
    setAdminData(data);
  };

  const boot = async () => {
    setLoading(true);
    setError('');

    try {
      await syncUser();
      await Promise.all([fetchMarketplace(), fetchMyArea()]);
    } catch (bootError) {
      setError(bootError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    boot();
  }, []);

  useEffect(() => {
    fetchMarketplace().catch(() => {});
  }, [search, category, priceMinFilter, priceMaxFilter, dateAdded, sortBy]);

  useEffect(() => {
    if (user?.role === 'admin') {
      fetchAdmin().catch(() => {});
    }
  }, [user?.role]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }

    const timer = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!selectedConversation) {
      return undefined;
    }

    const loadMessages = () =>
      api(`/chat/conversations/${selectedConversation._id}/messages`)
        .then((data) => setMessages(data.messages))
        .catch(() => {});

    loadMessages();
    const interval = setInterval(loadMessages, 5000);
    return () => clearInterval(interval);
  }, [selectedConversation]);

  const selectedPartner = useMemo(() => {
    if (!selectedConversation || !user) {
      return null;
    }

    return selectedConversation.participants.find((item) => item.username !== user.username);
  }, [selectedConversation, user]);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const contactSeller = async (post) => {
    const data = await api('/chat/conversations', {
      method: 'POST',
      body: JSON.stringify({ postId: post._id })
    });
    setSelectedConversation(data.conversation);
    setActiveTab('chat');
    const chatData = await api('/chat/conversations');
    setConversations(chatData.conversations);
  };

  const submitPost = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api('/posts', {
        method: 'POST',
        body: JSON.stringify({
          ...postForm,
          priceMin: Number(postForm.priceMin),
          quantityValue: Number(postForm.quantityValue)
        })
      });
      setToast('Post submitted for admin review.');
      setPostForm(initialPostForm);
      await Promise.all([fetchMyArea(), fetchMarketplace(), fetchAdmin()]);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  const submitCategoryRequest = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      await api('/posts/categories/request', {
        method: 'POST',
        body: JSON.stringify(categoryRequestForm)
      });
      setCategoryRequestForm(initialCategoryRequest);
      setToast('Custom category sent for admin approval.');
      await fetchAdmin();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  const submitUpgrade = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');

    try {
      const data = await api('/auth/upgrade-request', {
        method: 'POST',
        body: JSON.stringify({
          paymentReference: upgradeForm.paymentReference,
          months: Number(upgradeForm.months)
        })
      });
      setPendingUpgrade(data.request);
      setToast('Upgrade request sent to admin for confirmation.');
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  };

  const sendChat = async (event) => {
    event.preventDefault();
    if (!messageText.trim() || !selectedConversation) {
      return;
    }

    await api(`/chat/conversations/${selectedConversation._id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ text: messageText })
    });
    setMessageText('');
    const [messageData, chats] = await Promise.all([api(`/chat/conversations/${selectedConversation._id}/messages`), api('/chat/conversations')]);
    setMessages(messageData.messages);
    setConversations(chats.conversations);
  };

  const saveProfile = async (payload) => {
    const data = await api('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
    setUser(data.user);
    setToast('Profile updated successfully.');
  };

  const removePost = async (id) => {
    await api(`/posts/${id}`, { method: 'DELETE' });
    setToast('Post removed.');
    await Promise.all([fetchMarketplace(), fetchMyArea(), fetchAdmin()]);
  };

  const moderatePost = async (id, status) => {
    await api(`/admin/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        status,
        flaggedReason: status === 'rejected' ? 'Sensitive or policy-violating content' : ''
      })
    });
    setToast(`Post ${status}.`);
    await Promise.all([fetchMarketplace(), fetchAdmin()]);
  };

  const reviewUpgrade = async (requestId, status) => {
    if (status === 'approved' && !paymentChecks[requestId]) {
      setToast('Select the payment done checkbox before upgrading this user.');
      return;
    }

    await api(`/admin/upgrades/${requestId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status,
        paymentConfirmed: Boolean(paymentChecks[requestId])
      })
    });
    setToast(`Upgrade request ${status}.`);
    await Promise.all([syncUser(), fetchAdmin()]);
  };

  const reviewCategory = async (requestId, status) => {
    await api(`/admin/categories/${requestId}`, {
      method: 'PUT',
      body: JSON.stringify({ status })
    });
    setToast(`Category request ${status}.`);
    await Promise.all([fetchMarketplace(), fetchAdmin()]);
  };

  const handlePostImage = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPostForm((prev) => ({
        ...prev,
        imageUrl: String(reader.result || '')
      }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="dashboard-page">
      <LoaderOverlay visible={showLoader} />

      <header className="topbar">
        <div className="topbar__copy">
          <h1>Zero-Waste Marketplace</h1>
          <p>Industrial symbiosis for responsible consumption, practical reuse, and greener supplier discovery.</p>
        </div>
        <div className="topbar__right">
          <button className="profile-pill" onClick={() => setProfileOpen(true)}>
            <Avatar user={user} className="avatar-shell--sm" />
            <strong>{user?.username}</strong>
          </button>
          <button className="ghost-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      <nav className="tabbar">
        {['marketplace', 'my-posts', 'chat', 'about', ...(user?.role === 'admin' ? ['admin'] : [])].map((tab) => (
          <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
            {tab === 'my-posts' ? 'My Posts' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {toast && <div className="toast">{toast}</div>}
      {error && <div className="error-banner">{error}</div>}

      <main className="dashboard-content">
        {activeTab === 'marketplace' && (
          <section className="panel-stack">
            <section className="hero-panel">
              <div>
                <h2>Live Industrial Exchange Network</h2>
                <p>Glowing links show potential waste-resource partnerships between active industry participants. Brighter nodes represent stronger recycling participation.</p>
              </div>
              <GraphView data={graph} />
            </section>

            <section className="toolbar toolbar--filters">
              <input placeholder="Search posts, waste types, purpose..." value={search} onChange={(event) => setSearch(event.target.value)} />
              <select value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <input type="number" min="0" placeholder="Min price" value={priceMinFilter} onChange={(event) => setPriceMinFilter(event.target.value)} />
              <input type="number" min="0" placeholder="Max price" value={priceMaxFilter} onChange={(event) => setPriceMaxFilter(event.target.value)} />
              <select value={dateAdded} onChange={(event) => setDateAdded(event.target.value)}>
                <option value="">Any date</option>
                <option value="today">Added today</option>
                <option value="7d">Last 7 days</option>
                <option value="30d">Last 30 days</option>
              </select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="price-low">Price: low to high</option>
                <option value="price-high">Price: high to low</option>
              </select>
            </section>

            <section className="post-grid">
              {posts.map((post) => (
                <PostCard key={post._id} post={post} onContactSeller={contactSeller} />
              ))}
              {!posts.length && <div className="empty-state">No approved posts match your search right now.</div>}
            </section>
          </section>
        )}

        {activeTab === 'my-posts' && (
          <section className="panel-stack">
            <section className="panel-two-column">
              <div className="soft-card">
                <h2>Your Upload Access</h2>
                <p>
                  Current role: <strong>{user?.role}</strong>
                </p>
                {superiorActive ? (
                  <p className="success-text">Superior upload access is active {user?.superiorUntil ? `until ${new Date(user.superiorUntil).toLocaleDateString()}` : ''}.</p>
                ) : (
                  <>
                    <p>Upgrade to superior for Rs.100 per month to upload waste/resource listings, reach more buyers, and grow your sustainability score.</p>
                    {pendingUpgrade ? (
                      <p className="warning-text">Your upgrade request is waiting for admin confirmation.</p>
                    ) : (
                      <form className="inline-form" onSubmit={submitUpgrade}>
                        <input
                          placeholder="Payment reference / transaction id"
                          value={upgradeForm.paymentReference}
                          onChange={(event) => setUpgradeForm({ ...upgradeForm, paymentReference: event.target.value })}
                          required
                        />
                        <select value={upgradeForm.months} onChange={(event) => setUpgradeForm({ ...upgradeForm, months: event.target.value })}>
                          <option value="1">1 Month - Rs.100</option>
                          <option value="3">3 Months - Rs.300</option>
                        </select>
                        <button>Request Upgrade</button>
                      </form>
                    )}
                  </>
                )}
              </div>

              <div className="panel-stack">
                <div className="soft-card">
                  <h2>Upload Post</h2>
                  {superiorActive ? (
                    <form className="upload-form" onSubmit={submitPost}>
                      <select value={postForm.category} onChange={(event) => setPostForm({ ...postForm, category: event.target.value })}>
                        {categories.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                      <input placeholder="Heading / Title" value={postForm.title} onChange={(event) => setPostForm({ ...postForm, title: event.target.value })} required />
                      <textarea placeholder="Purpose / Description" rows="3" value={postForm.description} onChange={(event) => setPostForm({ ...postForm, description: event.target.value })} required />
                      <input placeholder="Buyer use case / purpose" value={postForm.purpose} onChange={(event) => setPostForm({ ...postForm, purpose: event.target.value })} required />
                      <div className="split-row split-row--labels">
                        <label className="field-stack">
                          <span>Rate / Unit*</span>
                          <input type="number" min="0" placeholder="Enter price" value={postForm.priceMin} onChange={(event) => setPostForm({ ...postForm, priceMin: event.target.value })} required />
                        </label>
                        <label className="field-stack">
                          <span>Quantity*</span>
                          <input type="number" min="0" placeholder="Enter quantity" value={postForm.quantityValue} onChange={(event) => setPostForm({ ...postForm, quantityValue: event.target.value })} required />
                        </label>
                        <label className="field-stack">
                          <span>Metric Unit*</span>
                          <input placeholder="kg, ton, litre..." value={postForm.quantityUnit} onChange={(event) => setPostForm({ ...postForm, quantityUnit: event.target.value })} required />
                        </label>
                      </div>
                      <input placeholder="Image URL or small data URL" value={postForm.imageUrl} onChange={(event) => setPostForm({ ...postForm, imageUrl: event.target.value })} />
                      <input type="file" accept="image/*" onChange={handlePostImage} />
                      <button disabled={saving}>{saving ? 'Submitting...' : 'Upload for Review'}</button>
                    </form>
                  ) : (
                    <div className="empty-state">Upgrade to superior to unlock post uploads and premium marketplace visibility.</div>
                  )}
                </div>

                <div className="soft-card">
                  <h2>Request A Custom Category</h2>
                  <p>Need a niche material type that is not listed yet? Send it for admin approval so future uploads stay clean and consistent.</p>
                  <form className="upload-form" onSubmit={submitCategoryRequest}>
                    <input
                      placeholder="Category name"
                      value={categoryRequestForm.name}
                      onChange={(event) => setCategoryRequestForm({ ...categoryRequestForm, name: event.target.value })}
                      required
                    />
                    <textarea
                      rows="3"
                      placeholder="Explain where this category fits in the circular exchange"
                      value={categoryRequestForm.description}
                      onChange={(event) => setCategoryRequestForm({ ...categoryRequestForm, description: event.target.value })}
                    />
                    <button disabled={saving}>{saving ? 'Sending...' : 'Submit Category Request'}</button>
                  </form>
                </div>
              </div>
            </section>

            <section className="post-grid">
              {myPosts.map((post) => (
                <PostCard key={post._id} post={post} onDelete={removePost} />
              ))}
              {!myPosts.length && <div className="empty-state">You have not posted any industrial resources yet.</div>}
            </section>
          </section>
        )}

        {activeTab === 'chat' && (
          <section className="chat-layout">
            <aside className="conversation-list">
              <h2>Conversations</h2>
              {conversations.map((conversation) => {
                const partner = conversation.participants.find((item) => item.username !== user.username);
                return (
                  <button key={conversation._id} className={selectedConversation?._id === conversation._id ? 'active' : ''} onClick={() => setSelectedConversation(conversation)}>
                    <div className="conversation-list__item">
                      <Avatar user={partner} className="avatar-shell--sm" />
                      <div>
                        <strong>{partner?.username || 'Seller'}</strong>
                        <span>{conversation.post?.title}</span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </aside>

            <section className="chat-panel">
              {selectedConversation ? (
                <>
                  <div className="chat-header">
                    <div className="chat-header__profile">
                      <Avatar user={selectedPartner} />
                      <div>
                        <h3>{selectedPartner?.username}</h3>
                        <p>{selectedConversation.post?.title}</p>
                      </div>
                    </div>
                  </div>

                  <div className="message-list">
                    {messages.map((message) => (
                      <div key={message._id} className={`message-row ${message.sender.username === user.username ? 'message-row--me' : ''}`}>
                        <Avatar user={message.sender} className="avatar-shell--sm" />
                        <div className={`message ${message.sender.username === user.username ? 'message--me' : ''}`}>
                          <strong>{message.sender.username}</strong>
                          <span>{message.text}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <form className="chat-form" onSubmit={sendChat}>
                    <input placeholder="Type your message..." value={messageText} onChange={(event) => setMessageText(event.target.value)} />
                    <button>Send</button>
                  </form>
                </>
              ) : (
                <div className="empty-state">Pick a seller conversation or click "Contact Seller" from any post.</div>
              )}
            </section>
          </section>
        )}

        {activeTab === 'about' && (
          <section className="about-grid">
            <div className="soft-card">
              <h2>About The Platform</h2>
              <p>This platform helps manufacturers, recyclers, and industrial buyers convert reusable waste streams into traceable marketplace opportunities.</p>
              <p>Users can discover approved listings, message the correct seller profile directly, monitor marketplace activity, and build more sustainable supply relationships through a single workflow.</p>
              <p>Admins moderate listings, review upload upgrades, and approve new categories so the data stays useful as the exchange network expands.</p>
            </div>
          </section>
        )}

        {activeTab === 'admin' && user?.role === 'admin' && (
          <section className="panel-stack">
            <div className="soft-card">
              <h2>Pending Post Moderation</h2>
              <div className="post-grid">
                {adminData.pendingPosts.map((post) => (
                  <div key={post._id} className="admin-card">
                    <PostCard post={post} onDelete={removePost} isAdmin />
                    <div className="admin-actions">
                      <button onClick={() => moderatePost(post._id, 'approved')}>Approve</button>
                      <button className="ghost-btn" onClick={() => moderatePost(post._id, 'rejected')}>
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="soft-card">
              <h2>Upgrade Monitoring</h2>
              {adminData.requests.map((request) => (
                <div key={request._id} className="request-row">
                  <div>
                    <strong>{request.user?.username}</strong>
                    <p>Ref: {request.paymentReference} • Amount: Rs.{request.amount}</p>
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={Boolean(paymentChecks[request._id])}
                      onChange={(event) => setPaymentChecks({ ...paymentChecks, [request._id]: event.target.checked })}
                    />
                    Payment done
                  </label>
                  <div className="admin-actions">
                    <button onClick={() => reviewUpgrade(request._id, 'approved')}>Upgrade User</button>
                    <button className="ghost-btn" onClick={() => reviewUpgrade(request._id, 'rejected')}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="soft-card">
              <h2>Custom Category Requests</h2>
              {adminData.pendingCategories.map((request) => (
                <div key={request._id} className="request-row">
                  <div>
                    <strong>{request.name}</strong>
                    <p>
                      Requested by {request.requestedBy?.username} on {new Date(request.createdAt).toLocaleDateString()}
                    </p>
                    {request.description && <p>{request.description}</p>}
                  </div>
                  <div className="admin-actions">
                    <button onClick={() => reviewCategory(request._id, 'approved')}>Approve</button>
                    <button className="ghost-btn" onClick={() => reviewCategory(request._id, 'rejected')}>
                      Reject
                    </button>
                  </div>
                </div>
              ))}
              {!adminData.pendingCategories.length && <div className="empty-state">No custom category requests are waiting right now.</div>}
            </div>
          </section>
        )}
      </main>

      {profileOpen && <ProfileModal user={user} onClose={() => setProfileOpen(false)} onSave={saveProfile} />}
    </div>
  );
}
