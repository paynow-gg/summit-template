/*!
 * Summit Theme - https://benjdzn.com
 * Author: Benj
 * Powered by Paynow.gg
 */
function tooltip(t = "") {
    return { show: !1, message: t };
}
const hero = document.querySelector("#hero");
(hero.style.transform = "scale(1)"), (hero.style.transformOrigin = "center center"), (hero.style.transition = "transform 0.3s ease-out");
let ticking = !1;
function updateHeroScale() {
    const t = window.scrollY,
        e = hero.offsetHeight;
    if (t > 0.5 * e) {
        const i = t - 0.5 * e,
            o = 0.5 * e,
            s = 1 - 0.15 * Math.min(i / o, 1);
        hero.style.transform = `scale(${Math.max(s, 0.85)})`;
    } else hero.style.transform = "scale(1)";
    ticking = !1;
}
function animateCount(t, e) {
    const i = parseInt(t.textContent.replace(/[^d]/g, "")) || 0;
    (t.textContent = "0"),
        gsap.to(
            { val: i },
            {
                val: e,
                duration: 1,
                ease: "power2.out",
                onUpdate: function () {
                    t.textContent = Math.floor(this.targets()[0].val);
                },
            }
        ),
        gsap.to(t, { scale: 1, opacity: 1, duration: 0.6, ease: "back.out(2)" });
}
function storeApp() {
    return {
        modal: { isOpen: !1, type: null, data: null, subscription: !1 },
        cart: {
            isLoading: !0,
            isOpen: !1,
            items: [],
            get total() {
                return this.items.reduce((t, e) => t + e.price * e.quantity, 0);
            },
        },
        init() {
            this.loadCartFromServer();
        },
        loadCartFromServer() {
            void 0 !== window.cartData &&
                (this.cart.items = (window.cartData.items || []).map((t) => {
                    const e = window.cartData.raw?.lines?.find((e) => e.line_key === t.id || e.product_id === t.id);
                    return {
                        id: t.id || t.productId || "",
                        slug: t.slug || t.productSlug || "",
                        name: t.name || t.productName || "Unknown Product",
                        price: parseFloat(t.price) || 0,
                        quantity: parseInt(t.quantity) || 1,
                        currency: t.currency || "USD",
                        subscription: e?.subscription || !1,
                        cartKey: `${t.id}_${e?.subscription ? "sub" : "onetime"}`,
                    };
                }));
        },
        openModal(t, e = null) {
            (this.modal.type = t), (this.modal.data = e), e && (this.modal.subscription = e.isSubscription), console.log(e), (this.modal.isOpen = !0), (document.body.style.overflow = "hidden");
        },
        closeModal() {
            (this.modal.isOpen = !1),
                (document.body.style.overflow = ""),
                setTimeout(() => {
                    (this.modal.type = null), (this.modal.data = null);
                }, 200);
        },
        toggleCart() {
            (this.cart.isOpen = !this.cart.isOpen), (this.cart.isLoading = !1), this.cart.isOpen ? (document.body.style.overflow = "hidden") : (document.body.style.overflow = "");
        },
        isLoggedIn: () => window.cartData && window.cartData.customer,
        redirectToLogin(t = "Please log in to continue") {
            this.showNotification(t, "warning"),
                setTimeout(() => {
                    window.location.href = "/auth/sign-in?redirect=" + encodeURIComponent(window.location.pathname);
                }, 1500);
        },

        async giftViaCart(t) {
            if (!this.isLoggedIn()) return void this.redirectToLogin("Please log in to purchase gifts");
            const e = document.getElementById("idInput"),
                i = e?.value?.trim();
            if (!i) return void this.showNotification("Please enter a recipient ID", "error");
            if ("steam" === t && !this.isValidSteamID(i)) return void this.showNotification("Please enter a valid SteamID64!", "error");
            const o = this.modal.data;
            if (o)
                try {
                    this.showNotification("Processing gift purchase...", "info");
                    const e = new URLSearchParams({ gift_to: i, gift_platform: t });
                    o.gameServerId && e.set("gameserver_id", o.gameServerId),
                        o.customVariables &&
                            Object.entries(o.customVariables).forEach(([t, i]) => {
                                e.set(`custom_variables[${t}]`, i);
                            });
                    this.modal.subscription && e.set("subscription", "true");
                    const s = `/products/${o.slug}/checkout?${e.toString()}`;
                    this.showNotification("Redirecting to gift checkout...", "success"),
                        this.closeModal(),
                        setTimeout(() => {
                            window.location.href = s;
                        }, 1e3);
                } catch (t) {
                    console.error("Error processing gift:", t), this.showNotification("Error processing gift purchase", "error");
                }
            else this.showNotification("No product selected", "error");
        },
        isValidSteamID: (t) => /^7656119\d{10}$/.test(t),

        async addToCart(t, e = !1, a = !1) {
            // e = subscription flag (true/false)
            // a = trial (true/false)
        
            if (!this.isLoggedIn()) {
                return void this.redirectToLogin("Please log in to modify cart");
            }
        
            // 🚫 Prevent multiple subscriptions
            if (e) {
                const alreadySub = this.cart.items.find((item) => item.subscription === true);
                if (alreadySub) {
                    this.showNotification(
                        `You already have a subscription in your cart (${alreadySub.name}). Remove it first before adding another.`,
                        "warning"
                    );
                    this.cart.isOpen = true;
                    document.body.style.overflow = "hidden";
                    return;
                }
            }
        
            // 🚫 Prevent multiple trials
            if (a) {
                const alreadyTrial = this.cart.items.find((item) => item.trial);
                if (alreadyTrial) {
                    this.showNotification(
                        `You already have a trial in your cart (${alreadyTrial.name}). Remove it first before adding another.`,
                        "warning"
                    );
                    this.cart.isOpen = true;
                    document.body.style.overflow = "hidden";
                    return;
                }
            }
        
            const existing = this.cart.items.find((item) => item.id === t.id);
            if (existing) {
                if (!existing.subscription) {
                    existing.quantity += 1;
                    return void this.showNotification(`${t.name} quantity increased!`, "success");
                } else {
                    this.showNotification(`${t.name} is already in your cart.`, "warning");
                    this.cart.isOpen = true;
                    document.body.style.overflow = "hidden";
                    return;
                }
            }
        
            try {
                this.showNotification(`Adding ${t.name} to cart...`, "info");
        
                const params = new URLSearchParams();
        
                // Handle optional server ID / custom variables
                if (t.gameServerId) params.set("gameserver_id", t.gameServerId);
                if (t.customVariables) {
                    Object.entries(t.customVariables).forEach(([key, val]) => {
                        params.set(`custom_variables[${key}]`, val);
                    });
                }
        
                // Handle subscription flag
                if (e) params.set("subscription", "true");
        
                // Handle trial (as simple flag like original system)
                if (a) params.set("trial", "true");
        
                const query = params.toString();
                const url = `/cart/add/${t.slug}${query ? "?" + query : ""}`;
        
                // 🚀 Redirect straight to checkout for subscriptions or trials
                if (e || a) {
                    await fetch(url, { method: "GET", headers: { "X-Requested-With": "XMLHttpRequest" } });
                    window.location.href = "/cart/checkout";
                    return;
                }
        
                // 🛒 Normal one-time cart flow
                const res = await fetch(url, { method: "GET", headers: { "X-Requested-With": "XMLHttpRequest" } });
                if (res.ok) {
                    this.cart.items.push({
                        id: t.id,
                        slug: t.slug,
                        name: t.name,
                        price: t.price,
                        currency: t.currency || "USD",
                        quantity: 1,
                        subscription: e,
                        trial: a || false
                    });
        
                    this.showNotification(`${t.name} added to your cart!`, "success");
                    this.cart.isOpen = true;
                    this.cart.isLoading = true;
                    document.body.style.overflow = "hidden";
        
                    setTimeout(() => {
                        this.cart.isLoading = false;
                    }, 1000);
                } else {
                    this.showNotification("Redirecting to cart...", "info");
                    setTimeout(() => {
                        window.location.href = url;
                    }, 1000);
                }
            } catch (err) {
                console.error("Error adding to cart:", err);
                window.location.href = "/cart/checkout";
            }
        },
        
        proceedToCheckout() {
            if (!this.isLoggedIn()) return void this.redirectToLogin("Please log in to proceed to checkout");
            const t = this.cart.items.filter((t) => t.isGift),
                e = this.cart.items.filter((t) => !t.isGift);
            t.length > 0 && e.length > 0
                ? this.showNotification("Please checkout gift items separately from regular items", "warning")
                : 1 !== t.length || 0 !== e.length
                ? t.length > 1
                    ? this.showNotification("Gift items must be purchased one at a time", "warning")
                    : (window.location.href = "/cart/checkout")
                : (window.location.href = t[0].giftCheckoutUrl);
        },
        async removeFromCart(t) {
            if (this.isLoggedIn())
                try {
                    this.cart.isLoading = !0;
                    const e = this.cart.items.find((e) => e.id === t);
                    if (!e) return;
                    this.cart.items = this.cart.items.filter((e) => e.id !== t);
                    const i = await fetch(`/cart/remove/${e.slug}`, { method: "GET", headers: { "X-Requested-With": "XMLHttpRequest" } });
                    i.ok || 404 === i.status ? this.showNotification("Item removed from cart", "success") : (this.cart.items.push(e), this.showNotification("Failed to remove item", "error")), (this.cart.isLoading = !1);
                } catch (t) {
                    console.error("Error removing from cart:", t), this.showNotification("Item removed locally", "info");
                }
            else this.redirectToLogin("Please log in to modify cart");
        },
        getProductCartStatus(t) {
            const e = this.cart.items.find((e) => e.id === t);
            return e ? { inCart: !0, subscription: e.subscription, quantity: e.quantity, item: e } : { inCart: !1, subscription: null, quantity: 0 };
        },
        getAddToCartButtonState(t, e) {
            const i = this.getProductCartStatus(t);
            if (!i.inCart) return { disabled: !1, text: e ? "Subscribe" : "Add to Cart", variant: "primary" };
            if (i.subscription === e) return { disabled: !1, text: `Add Another (${i.quantity} in cart)`, variant: "secondary" };
            return { disabled: !0, text: `Already in cart as ${i.subscription ? "subscription" : "one-time"}`, variant: "disabled" };
        },
        async updateQuantity(t, e) {
            if (!this.isLoggedIn()) return void this.redirectToLogin("Please log in to modify cart");
            const i = this.cart.items.find((e) => e.id === t);
            if (i && (i.isGift || i.subscription)) i.isGift ? this.showNotification("Gift items cannot have quantity changed", "warning") : this.showNotification("Subscription items are limited to quantity 1", "warning");
            else if (e <= 0) this.removeFromCart(t);
            else if (i) {
                const t = i.quantity;
                i.quantity = e;
                try {
                    const o = new FormData();
                    o.append("quantity", e.toString());
                    (await fetch(`/cart/set/${i.slug}`, { method: "POST", headers: { "X-Requested-With": "XMLHttpRequest" }, body: o })).ok
                        ? this.showNotification("Quantity updated", "success")
                        : ((i.quantity = t), this.showNotification("Failed to update quantity", "error"));
                } catch (t) {
                    console.error("Error updating quantity:", t), this.showNotification("Quantity updated locally", "info");
                }
            }
        },
        showNotification(t, e = "info") {
            let i = document.getElementById("cart-notification");
            i ||
                ((i = document.createElement("div")),
                (i.id = "cart-notification"),
                (i.className = "fixed top-4 right-4 z-50 px-6 py-3 rounded-lg font-medium text-white transform transition-all duration-300 translate-x-full shadow-lg"),
                document.body.appendChild(i)),
                (i.textContent = t),
                (i.className = i.className.replace(/bg-\w+-500/g, "")),
                "success" === e ? i.classList.add("bg-green-500") : "error" === e ? i.classList.add("bg-red-500") : "warning" === e ? i.classList.add("bg-yellow-500") : i.classList.add("bg-blue-500"),
                requestAnimationFrame(() => {
                    i.classList.remove("translate-x-full");
                }),
                setTimeout(() => {
                    i.classList.add("translate-x-full"), 
                        setTimeout(() => {
                            i.parentNode && i.remove();
                        }, 300);
                }, 3e3);
        },
    };
}
if (
    (window.addEventListener("scroll", () => {
        ticking || (requestAnimationFrame(updateHeroScale), (ticking = !0));
    }),
    window.addEventListener("load", () => {
        (hero.style.transform = "scale(1)"), updateHeroScale();
    }),
    (hero.style.transform = "scale(1)"),
    updateHeroScale(),
    "undefined" != typeof ClipboardJS &&
        (new ClipboardJS("#copy"),
        $("#copy").on("click", function () {
            const t = $(this).find("p");
            t.text("COPIED"), setTimeout(() => t.text("Copy IP"), 2e3);
        })),
    "undefined" != typeof MinecraftAPI &&
        MinecraftAPI.getServerStatus(server, { port: serverPort }, function (t, e) {
            if (!t && e.players) {
                animateCount(document.querySelector("#copy .count"), e.players.now);
            } else {
                animateCount(document.querySelector("#copy .count"), 0);
            }
        }),
    discordId &&
        $.get("https://discordapp.com/api/guilds/" + discordId + "/embed.json", function (t) {
            animateCount(document.querySelector("#discord .count"), t.presence_count);
        }),
    document.addEventListener("keydown", function (t) {
        if ("Escape" === t.key) {
            const t = Alpine.$data(document.body);
            t && t.modal && t.modal.isOpen ? t.closeModal() : t && t.cart && t.cart.isOpen && t.toggleCart();
        }
    }),
    "undefined" == typeof Alpine)
) {
    const t = document.createElement("script");
    (t.src = "https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"), (t.defer = !0), document.head.appendChild(t);
}
