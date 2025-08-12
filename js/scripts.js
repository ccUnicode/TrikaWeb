document.addEventListener("DOMContentLoaded", () => {
    const animationContainer = document.getElementById('animation-container');
    const animationItems = animationContainer.querySelectorAll('.animation-item');
    

    function randomizeContent() {
        const texts = ["Software", "Sistemas", "Industrial"];
        let usedTexts = [];

        animationItems.forEach(item => {
            const isTextItem = Math.random() > 0.5;
            if (isTextItem && usedTexts.length < texts.length) {
                let text;
                do {
                    text = texts[Math.floor(Math.random() * texts.length)];
                } while (usedTexts.includes(text));
                item.textContent = text;
                item.classList.remove('dark');
                usedTexts.push(text);
            } else {
                item.textContent = '';
                item.classList.add('dark');
            }
        });
    }

    function animateItems() {
        animationItems.forEach((item, index) => {
            const delay = index * 0.5; // Incrementa el delay para cada item
            item.style.animationDelay = `${delay}s`;
        });
    }

    randomizeContent();
    animateItems();
    setInterval(() => {
        randomizeContent();
        animateItems();
    }, 5000);
});
