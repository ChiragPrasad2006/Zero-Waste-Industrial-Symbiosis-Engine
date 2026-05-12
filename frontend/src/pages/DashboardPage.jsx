import { useEffect, useMemo, useState } from 'react';
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
  priceMin: 0,
  quantityValue: 0,
  quantityUnit: 'kg',
  imageUrl: '',
  wasteAttributes: '{\n  "industryType": "Metal Works"\n}'
};

export default function DashboardPage() {
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
  const [postForm, setPostForm] = useState(initialPostForm);
  const [upgradeForm, setUpgradeForm] = useState({ paymentReference: '', months: 1 });
  const [adminData, setAdminData] = useState({ pendingPosts: [], requests: [], users: [] });
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

    const [postsData, categoryData, graphData] = await Promise.all([
      api(`/posts?${query.toString()}`),
      api('/posts/categories'),
      api('/graph')
    ]);

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
      await Promise.all([fetchMarketplace(), fetchMyArea(), fetchAdmin()]);
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
    if (user?.role === 'admin') {
      fetchAdmin().catch(() => {});
    }
  }, [user?.role]);

  useEffect(() => {
    fetchMarketplace().catch(() => {});
  }, [search, category]);

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
          quantityValue: Number(postForm.quantityValue),
          wasteAttributes: JSON.parse(postForm.wasteAttributes || '{}')
        })
      });
      setToast('Post submitted for admin review.');
      setPostForm(initialPostForm);
      await fetchMyArea();
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
    const data = await api(`/chat/conversations/${selectedConversation._id}/messages`);
    setMessages(data.messages);
    const chats = await api('/chat/conversations');
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
        <div>
          <h1>Zero-Waste Marketplace</h1>
          <p>Industrial symbiosis for responsible consumption and production.</p>
        </div>
        <div className="topbar__right">
          <button className="profile-pill" onClick={() => setProfileOpen(true)}>
            {user?.profileImage ? <img src={user.profileImage} alt={user.username} /> : <span>{user?.username?.[0]?.toUpperCase()}</span>}
            <strong>{user?.username}</strong>
          </button>
          <button className="ghost-btn" onClick={logout}>
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
                <p>Glowing links show potential waste-resource partnerships. Brighter nodes represent stronger recycling participation.</p>
              </div>
              <GraphView data={graph} />
            </section>

            <section className="toolbar">
              <input placeholder="Search posts, waste types, purpose..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
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
                          onChange={(e) => setUpgradeForm({ ...upgradeForm, paymentReference: e.target.value })}
                          required
                        />
                        <select value={upgradeForm.months} onChange={(e) => setUpgradeForm({ ...upgradeForm, months: e.target.value })}>
                          <option value="1">1 Month - Rs.100</option>
                          <option value="3">3 Months - Rs.300</option>
                        </select>
                        <button>Request Upgrade</button>
                      </form>
                    )}
                  </>
                )}
              </div>

              <div className="soft-card">
                <h2>Upload Post</h2>
                {superiorActive ? (
                  <form className="upload-form" onSubmit={submitPost}>
                    <select value={postForm.category} onChange={(e) => setPostForm({ ...postForm, category: e.target.value })}>
                      <option>Excess Heat</option>
                      <option>Steam Waste</option>
                      <option>Scrap Aluminum</option>
                      <option>Chemical Sludge</option>
                      <option>Packaging Waste</option>
                      <option>Fly Ash</option>
                    </select>
                    <input placeholder="Heading / Title" value={postForm.title} onChange={(e) => setPostForm({ ...postForm, title: e.target.value })} required />
                    <textarea placeholder="Purpose / Description" rows="3" value={postForm.description} onChange={(e) => setPostForm({ ...postForm, description: e.target.value })} required />
                    <input placeholder="Buyer use case / purpose" value={postForm.purpose} onChange={(e) => setPostForm({ ...postForm, purpose: e.target.value })} required />
                    <div className="split-row">
                      <input type="number" min="0" placeholder="Minimum price" value={postForm.priceMin} onChange={(e) => setPostForm({ ...postForm, priceMin: e.target.value })} required />
                      <input type="number" min="0" placeholder="Quantity" value={postForm.quantityValue} onChange={(e) => setPostForm({ ...postForm, quantityValue: e.target.value })} required />
                      <input placeholder="Metric unit" value={postForm.quantityUnit} onChange={(e) => setPostForm({ ...postForm, quantityUnit: e.target.value })} required />
                    </div>
                    <input placeholder="Image URL or small data URL" value={postForm.imageUrl} onChange={(e) => setPostForm({ ...postForm, imageUrl: e.target.value })} />
                    <input type="file" accept="image/*" onChange={handlePostImage} />
                    <textarea
                      rows="6"
                      placeholder='Extra attributes JSON e.g. {"temperature":"high","purity":"85%"}'
                      value={postForm.wasteAttributes}
                      onChange={(e) => setPostForm({ ...postForm, wasteAttributes: e.target.value })}
                    />
                    <button disabled={saving}>{saving ? 'Submitting...' : 'Upload for Review'}</button>
                  </form>
                ) : (
                  <div className="empty-state">Upgrade to superior to unlock post uploads and premium marketplace visibility.</div>
                )}
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
                    <strong>{partner?.username || 'Seller'}</strong>
                    <span>{conversation.post?.title}</span>
                  </button>
                );
              })}
            </aside>
            <section className="chat-panel">
              {selectedConversation ? (
                <>
                  <div className="chat-header">
                    <h3>{selectedPartner?.username}</h3>
                    <p>{selectedConversation.post?.title}</p>
                  </div>
                  <div className="message-list">
                    {messages.map((message) => (
                      <div key={message._id} className={`message ${message.sender.username === user.username ? 'message--me' : ''}`}>
                        <span>{message.text}</span>
                      </div>
                    ))}
                  </div>
                  <form className="chat-form" onSubmit={sendChat}>
                    <input placeholder="Type your message..." value={messageText} onChange={(e) => setMessageText(e.target.value)} />
                    <button>Send</button>
                  </form>
                </>
              ) : (
                <div className="empty-state">Pick a seller conversation or click “Contact Seller” from any post.</div>
              )}
            </section>
          </section>
        )}

        {activeTab === 'about' && (
          <section className="about-grid">
            <div className="soft-card">
              <h2>About The Platform</h2>
              <p>This platform supports circular economy collaboration between factories by helping one industry's waste become another industry's input.</p>
              <p>MongoDB is used because industrial waste listings can vary massively in structure, which makes flexible document storage ideal for category-specific attributes.</p>
            </div>
            <div className="soft-card">
              <h2>Suggested Better Alternatives</h2>
              <ul>
                <li>Use Razorpay subscriptions for real monthly payments instead of manual admin confirmation.</li>
                <li>Use Cloudinary for image storage if you deploy publicly.</li>
                <li>Use WebSockets later for fully real-time chat if your hosting allows it.</li>
              </ul>
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
                    <p>
                      Ref: {request.paymentReference} • Amount: Rs.{request.amount}
                    </p>
                  </div>
                  <label className="check-row">
                    <input
                      type="checkbox"
                      checked={Boolean(paymentChecks[request._id])}
                      onChange={(e) => setPaymentChecks({ ...paymentChecks, [request._id]: e.target.checked })}
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
          </section>
        )}
      </main>

      {profileOpen && <ProfileModal user={user} onClose={() => setProfileOpen(false)} onSave={saveProfile} />}
    </div>
  );
}
