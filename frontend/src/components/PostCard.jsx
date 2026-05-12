export default function PostCard({ post, onContactSeller, onDelete, isAdmin }) {
  return (
    <article className="post-card">
      <div className="post-card__image">
        {post.imageUrl ? <img src={post.imageUrl} alt={post.title} /> : <div className="img-fallback">Waste Resource</div>}
      </div>
      <div className="post-card__content">
        <div className="post-card__row">
          <span className="chip">{post.category}</span>
          <span className={`status status--${post.status}`}>{post.status}</span>
        </div>
        <h3>{post.title}</h3>
        <p>{post.description}</p>
        <div className="post-meta">
          <span>Purpose: {post.purpose}</span>
          <span>
            From Rs. {post.priceMin} / {post.quantityUnit}
          </span>
          <span>
            Qty: {post.quantityValue} {post.quantityUnit}
          </span>
        </div>
        {post.seller && <p className="seller-name">Seller: {post.seller.username}</p>}
        <div className="post-card__actions">
          {onContactSeller && <button onClick={() => onContactSeller(post)}>Contact Seller</button>}
          {onDelete && <button className="ghost-btn" onClick={() => onDelete(post._id)}>Remove</button>}
          {isAdmin && post.flaggedReason && <span className="flag-reason">Reason: {post.flaggedReason}</span>}
        </div>
      </div>
    </article>
  );
}

