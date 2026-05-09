// Thêm hiệu ứng Glow nhẹ bắt theo vị trí chuột (Micro-interaction đặc trưng của Bento UI)
document.querySelectorAll('.bento-card').forEach(card => {
    card.addEventListener('mousemove', e => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Tạo một đốm sáng mờ nhẹ chạy theo chuột
        card.style.background = `radial-gradient(circle at ${x}px ${y}px, rgba(255, 255, 255, 0.8), transparent 40%), var(--bg-card)`;
    });

    card.addEventListener('mouseleave', () => {
        card.style.background = 'var(--bg-card)';
    });
});

// Chuyển đổi trạng thái Active trên Sidebar
const navLinks = document.querySelectorAll('.nav-links a');
navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault(); // Tránh reload trang
        navLinks.forEach(l => l.classList.remove('active'));
        link.classList.add('active');
    });
});
