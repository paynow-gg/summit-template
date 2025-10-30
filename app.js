/*!
 * Summit Theme - https://benjdzn.com
 * Author: Benj
 * Powered by Paynow.gg
 */

function tooltip(message = "") {
    return {
        show: false,
        message: message
    };
}

// Hero section scaling setup
const hero = document.querySelector("#hero");
hero.style.transform = "scale(1)";
hero.style.transformOrigin = "center center";
hero.style.transition = "transform 0.3s ease-out";

let ticking = false;

function updateHeroScale() {
    const scrollY = window.scrollY;
    const heroHeight = hero.offsetHeight;
    
    if (scrollY > 0.5 * heroHeight) {
        const scrollDistance = scrollY - 0.5 * heroHeight;
        const halfHeroHeight = 0.5 * heroHeight;
        const scaleValue = 1 - 0.15 * Math.min(scrollDistance / halfHeroHeight, 1);
        hero.style.transform = `scale(${Math.max(scaleValue, 0.85)})`;
    } else {
        hero.style.transform = "scale(1)";
    }
    
    ticking = false;
}

function animateCount(element, targetValue) {
    const startValue = parseInt(element.textContent.replace(/[^\d]/g, "")) || 0;
    element.textContent = "0";
    
    gsap.to(
        { val: 0 },
        {
            val: targetValue,
            duration: 1,
            ease: "power2.out",
            onUpdate: function () {
                element.textContent = Math.floor(this.targets()[0].val);
            }
        }
    );
    
    gsap.to(element, {
        scale: 1,
        opacity: 1,
        duration: 0.6,
        ease: "back.out(2)"
    });
}

function storeApp() {
    return {
        modal: {
            isOpen: false,
            type: null,
            data: null,
            subscription: false,
            showOptions: false,
            selectedAction: null, // 'add', 'subscribe', 'trial', 'gift'
            giftRecipientId: null,
            giftPlatform: null
        },
        
        cart: {
            isLoading: true,
            isOpen: false,
            items: [],
            
            get total() {
                return this.items.reduce((total, item) => total + item.price * item.quantity, 0);
            }
        },
        
        init() {
            this.loadCartFromServer();
        },
        
        loadCartFromServer() {
            if (window.cartData !== undefined) {

                this.cart.items = (window.cartData.items || []).map((item) => {
                    const rawLine = window.cartData.raw?.lines?.find(
                        (line) => line.line_key === item.id || line.product_id === item.id
                    );

                    const cartItem = {
                        id: item.id || item.productId || "",
                        slug: item.slug || item.productSlug || "",
                        name: item.name || item.productName || "Unknown Product",
                        price: parseFloat(item.price) || 0,
                        quantity: parseInt(item.quantity) || 1,
                        currency: item.currency || "USD",
                        subscription: rawLine?.subscription || false,
                        isTrial: rawLine?.trial || false,
                        cartKey: `${item.id}_${rawLine?.subscription ? "sub" : "onetime"}`
                    };

                    // Extract gameserver information if present (check both possible field names)
                    if (rawLine?.selected_gameserver) {
                        cartItem.gameServerName = rawLine.selected_gameserver.name || 'Unknown Server';
                    } else if (rawLine?.gameserver) {
                        cartItem.gameServerName = rawLine.gameserver.name || 'Unknown Server';
                    }

                    // Extract custom variables if present (array format from server)
                    if (rawLine?.custom_variables && Array.isArray(rawLine.custom_variables) && rawLine.custom_variables.length > 0) {
                        cartItem.customVariablesDisplay = {};

                        rawLine.custom_variables.forEach(customVar => {
                            if (customVar && customVar.name && (customVar.value || customVar.display_value)) {
                                const displayValue = customVar.display_value || customVar.value;
                                cartItem.customVariablesDisplay[customVar.name] = displayValue;
                            }
                        });

                    }
                    return cartItem;
                });
            }
        },
        
        openModal(type, data = null) {
            this.modal.type = type;
            this.modal.data = data;
            this.modal.showOptions = false;

            if (data) {
                this.modal.subscription = data.isSubscription;

                // Debug logging
                if (type === 'productInfo') {
                    console.log('=== PRODUCT MODAL OPENED ===');
                    console.log('Product Data:', data);
                    console.log('allowOnetimePurchase:', data.allowOnetimePurchase);
                    console.log('allowGifting:', data.allowGifting);
                    console.log('isSubscription:', data.isSubscription);
                    console.log('trial.enabled:', data.trial?.enabled);
                    console.log('single_game_server_only:', data.single_game_server_only);
                    console.log('gameservers:', data.gameservers);
                    console.log('custom_variables:', data.custom_variables);
                    console.log('========================');
                }
            }

            this.modal.isOpen = true;
            document.body.style.overflow = "hidden";
        },
        
        closeModal() {
            this.modal.isOpen = false;
            document.body.style.overflow = "";

            setTimeout(() => {
                this.modal.type = null;
                this.modal.data = null;
                this.modal.selectedAction = null;
                this.modal.giftRecipientId = null;
                this.modal.giftPlatform = null;
            }, 200);
        },
        
        toggleCart() {
            this.cart.isOpen = !this.cart.isOpen;
            this.cart.isLoading = false;
            
            if (this.cart.isOpen) {
                document.body.style.overflow = "hidden";
            } else {
                document.body.style.overflow = "";
            }
        },
        
        isLoggedIn: () => window.cartData && window.cartData.customer,
        
        redirectToLogin(message = "Please log in to continue") {
            this.showNotification(message, "warning");
            
            setTimeout(() => {
                window.location.href = "/auth/sign-in?redirect=" + encodeURIComponent(window.location.pathname);
            }, 1500);
        },
        
        async giftViaCart(platform) {
            if (!this.isLoggedIn()) {
                this.redirectToLogin("Please log in to purchase gifts");
                return;
            }

            const product = this.modal.data;

            // Get recipient ID from input or stored value
            const idInput = document.getElementById("idInput");
            let recipientId = this.modal.giftRecipientId || idInput?.value?.trim();

            // If we're not on the options screen yet, validate and store the recipient ID
            if (!this.modal.showOptions) {
                if (!recipientId) {
                    this.showNotification("Please enter a recipient ID", "error");
                    return;
                }

                if (platform === "steam" && !this.isValidSteamID(recipientId)) {
                    this.showNotification("Please enter a valid SteamID64!", "error");
                    return;
                }

                // Store the recipient info for when we come back from options screen
                this.modal.giftRecipientId = recipientId;
                this.modal.giftPlatform = platform;
            }

            // Check if product has gameservers or custom_variables and options haven't been selected yet
            const hasGameServers = product.single_game_server_only && product.gameservers && Object.keys(product.gameservers).length > 0;
            const hasCustomVariables = product.custom_variables && Object.keys(product.custom_variables).length > 0;

            // If gameserver exists but only one option, auto-select it
            if (hasGameServers && Object.keys(product.gameservers).length === 1 && !product.gameServerId) {
                const firstGameServer = Object.values(product.gameservers)[0];
                product.gameServerId = firstGameServer.id;
                product.gameServerName = firstGameServer.name;
            }

            // If product has options and they haven't been selected, show options screen
            if ((hasGameServers || hasCustomVariables) && !this.modal.showOptions) {
                this.modal.selectedAction = 'gift';
                this.modal.showOptions = true;
                return;
            }

            // If showOptions is true, collect the selected options
            if (this.modal.showOptions) {
                const options = this.collectProductOptions(product);

                if (options.gameServerId) {
                    product.gameServerId = options.gameServerId;
                    product.gameServerName = options.gameServerName;
                }
                if (options.customVariables) {
                    product.customVariables = options.customVariables;
                    product.customVariablesDisplay = options.customVariablesDisplay;
                }

                // Use stored values
                recipientId = this.modal.giftRecipientId;
                platform = this.modal.giftPlatform;
            }
            
            if (!product) {
                this.showNotification("No product selected", "error");
                return;
            }
            
            try {
                this.showNotification("Processing gift purchase...", "info");
                
                const params = new URLSearchParams({
                    gift_to: recipientId,
                    gift_platform: platform
                });
                
                if (product.gameServerId) {
                    params.set("gameserver_id", product.gameServerId);
                }
                
                if (product.customVariables) {
                    Object.entries(product.customVariables).forEach(([key, value]) => {
                        params.set(`custom_variables[${key}]`, value);
                    });
                }
                
                if (this.modal.subscription) {
                    params.set("subscription", "true");
                }
                
                const checkoutUrl = `/products/${product.slug}/checkout?${params.toString()}`;
                
                this.showNotification("Redirecting to gift checkout...", "success");
                this.closeModal();
                
                setTimeout(() => {
                    window.location.href = checkoutUrl;
                }, 1000);
                
            } catch (error) {
                console.error("Error processing gift:", error);
                this.showNotification("Error processing gift purchase", "error");
            }
        },
        
        isValidSteamID: (steamId) => /^7656119\d{10}$/.test(steamId),

        collectProductOptions(product) {
            const gameServerDropdown = document.getElementById('gameServerDropdown');
            const customVariableInputs = document.querySelectorAll('select[id^="customVariables"], input[id^="customVariables"]');

            const options = {};

            if (gameServerDropdown && gameServerDropdown.value) {
                options.gameServerId = gameServerDropdown.value;
                // Get the selected option text (gameserver name)
                options.gameServerName = gameServerDropdown.options[gameServerDropdown.selectedIndex]?.text || 'Unknown Server';
            }

            if (customVariableInputs.length > 0) {
                options.customVariables = {};
                options.customVariablesDisplay = {}; // For display in cart
                customVariableInputs.forEach(input => {
                    const identifier = input.name || input.id.replace('customVariables[', '').replace(']', '');
                    const value = input.value;

                    options.customVariables[identifier] = value;

                    // Get friendly name from product data if available
                    const customVar = product.custom_variables && Object.values(product.custom_variables).find(v => v.identifier === identifier);
                    const friendlyName = customVar?.name || identifier;

                    // For dropdowns, get the selected option text
                    let displayValue = value;
                    if (input.tagName === 'SELECT') {
                        displayValue = input.options[input.selectedIndex]?.text || value;
                    }

                    options.customVariablesDisplay[friendlyName] = displayValue;
                });
            }

            return options;
        },

        async addToCart(product, isSubscription = false, isTrial = false) {
            if (!this.isLoggedIn()) {
                this.redirectToLogin("Please log in to modify cart");
                return;
            }

            // Normalize isTrial - it can be a boolean or an object with trial details
            const isTrialPurchase = typeof isTrial === 'object' ? true : isTrial;

            // Check if product has gameservers or custom_variables and options haven't been selected yet
            const hasGameServers = product.single_game_server_only && product.gameservers && Object.keys(product.gameservers).length > 0;
            const hasCustomVariables = product.custom_variables && Object.keys(product.custom_variables).length > 0;

            // If gameserver exists but only one option, auto-select it
            if (hasGameServers && Object.keys(product.gameservers).length === 1 && !product.gameServerId) {
                const firstGameServer = Object.values(product.gameservers)[0];
                product.gameServerId = firstGameServer.id;
                product.gameServerName = firstGameServer.name;
            }

            // Determine which action was clicked and store it
            if (!this.modal.showOptions) {
                if (isTrialPurchase) {
                    this.modal.selectedAction = 'trial';
                } else if (isSubscription) {
                    this.modal.selectedAction = 'subscribe';
                } else {
                    this.modal.selectedAction = 'add';
                }
            }

            if ((hasGameServers || hasCustomVariables) && !this.modal.showOptions && !isTrialPurchase) {
                this.modal.showOptions = true;
                return;
            }

            // If showOptions is true, collect the selected options
            if (this.modal.showOptions) {
                const options = this.collectProductOptions(product);

                if (options.gameServerId) {
                    product.gameServerId = options.gameServerId;
                    product.gameServerName = options.gameServerName;
                }
                if (options.customVariables) {
                    product.customVariables = options.customVariables;
                    product.customVariablesDisplay = options.customVariablesDisplay;
                }

            } else if (isTrialPurchase && (hasGameServers || hasCustomVariables)) {
                // For trial purchases with options, show the options screen first
                this.modal.showOptions = true;
                return;
            }

            // Check if product is in stock
            if (product.inStock === false) {
                this.showNotification(`${product.name} is out of stock`, "error");
                return;
            }

            // Check for existing trial in cart (only one trial allowed total)
            if (isTrialPurchase) {
                const alreadyTrial = this.cart.items.find((item) => item.isTrial && item.id !== product.id);
                if (alreadyTrial) {
                    this.showNotification(
                        `You already have a trial in your cart (${alreadyTrial.name}). Remove it first before adding another.`,
                        "warning"
                    );
                    this.cart.isOpen = true;
                    setTimeout(() => {
                        this.cart.isLoading = false;
                    }, 1000);
                    document.body.style.overflow = "hidden";
                    return;
                }
            }

            // Check if product has options/configuration - if so, treat each configuration as separate line item
            const hasOptions = (hasGameServers || hasCustomVariables);

            // Find any existing version of this product in cart
            const existingItem = this.cart.items.find((item) => item.id === product.id);

            // Determine if we need to swap or increment
            if (existingItem && !hasOptions) {
                const existingIsTrial = existingItem.isTrial || false;
                const existingIsSubscription = existingItem.subscription || false;

                // Check if it's the EXACT same type (same product, same subscription status, same trial status)
                const isSameType = (existingIsSubscription === isSubscription) && (existingIsTrial === isTrialPurchase);

                if (isSameType) {
                    // Same exact product type - handle quantity increase
                    if (!isSubscription && !isTrialPurchase) {
                        // Regular product - can increment quantity
                        const newQuantity = existingItem.quantity + 1;
                        existingItem.quantity = newQuantity;
                        this.updateQuantity(product.id, newQuantity);
                        this.showNotification(`${product.name} quantity increased!`, "success");
                        this.closeModal();
                        return;
                    } else {
                        // Subscription or trial - can't add more than one
                        const typeDesc = isTrialPurchase ? "trial" : "subscription";
                        this.showNotification(
                            `${product.name} ${typeDesc} is already in your cart.`,
                            "warning"
                        );
                        this.closeModal();
                        this.cart.isOpen = true;
                        setTimeout(() => {
                            this.cart.isLoading = false;
                        }, 1000);
                        document.body.style.overflow = "hidden";
                        return;
                    }
                } else {
                    // Different type of same product - need to swap
                    const oldType = existingIsTrial ? "trial" : (existingIsSubscription ? "subscription" : "regular");
                    const newType = isTrialPurchase ? "trial" : (isSubscription ? "subscription" : "regular");

                    this.showNotification(`Swapping ${oldType} version with ${newType} version of ${product.name}`, "info");
                    await this.removeFromCart(product.id);
                    // Continue to add the new version below
                }
            }

            // If product has options, always allow adding as separate line item (each configuration is unique)
            if (hasOptions && existingItem) {
                this.showNotification(`Adding another ${product.name} with different configuration...`, "info");
            }

            try {
                this.showNotification(`Adding ${product.name} to cart...`, "info");

                const params = new URLSearchParams();

                if (product.gameServerId) {
                    params.set("gameserver_id", product.gameServerId);
                }

                if (product.customVariables) {
                    Object.entries(product.customVariables).forEach(([key, val]) => {
                        params.set(`custom_variables[${key}]`, val);
                    });
                }

                if (isSubscription) {
                    params.set("subscription", "true");
                }

                if (isTrialPurchase) {
                    params.set("trial", "true");
                }

                const query = params.toString();
                const url = `/cart/add/${product.slug}${query ? "?" + query : ""}`;

                const response = await fetch(url, {
                    method: "GET",
                    headers: { "X-Requested-With": "XMLHttpRequest" }
                });

                const responseQuery = new URL(response.url).searchParams;
                if (responseQuery.has('err')) {
                    const errorMessage = decodeURIComponent(responseQuery.get('err'));
                    this.showNotification(errorMessage, "error")
                    return;
                }

                if (response.ok) {
                    const cartItem = {
                        id: product.id,
                        slug: product.slug,
                        name: product.name,
                        price: product.price,
                        currency: product.currency || "USD",
                        quantity: 1,
                        subscription: isSubscription,
                        isTrial: isTrialPurchase || false
                    };

                    // Add gameserver display info if present
                    if (product.gameServerName) {
                        cartItem.gameServerName = product.gameServerName;
                    }

                    // Add custom variables display info if present
                    if (product.customVariablesDisplay) {
                        cartItem.customVariablesDisplay = product.customVariablesDisplay;
                    }

                    this.cart.items.push(cartItem);

                    this.showNotification(`${product.name} added to your cart!`, "success");
                    this.closeModal();
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
            } catch (error) {
                console.error("Error adding to cart:", error);
                window.location.href = "/cart/checkout";
            }
        },
        
        proceedToCheckout() {
            if (!this.isLoggedIn()) {
                this.redirectToLogin("Please log in to proceed to checkout");
                return;
            }
            
            const giftItems = this.cart.items.filter((item) => item.isGift);
            const regularItems = this.cart.items.filter((item) => !item.isGift);
            
            if (giftItems.length > 0 && regularItems.length > 0) {
                this.showNotification("Please checkout gift items separately from regular items", "warning");
            } else if (giftItems.length === 1 && regularItems.length === 0) {
                window.location.href = giftItems[0].giftCheckoutUrl;
            } else if (giftItems.length > 1) {
                this.showNotification("Gift items must be purchased one at a time", "warning");
            } else {
                window.location.href = "/cart/checkout";
            }
        },
        
        async removeFromCart(productId) {
            if (!this.isLoggedIn()) {
                this.redirectToLogin("Please log in to modify cart");
                return;
            }

            try {
                this.cart.isLoading = true;

                const item = this.cart.items.find((item) => item.id === productId);
                if (!item) return;

                // Remove item optimistically from local state
                this.cart.items = this.cart.items.filter((item) => item.id !== productId);

                // Use /cart/set with quantity=0 to remove entire item (all quantities)
                // This ensures all quantities are removed, not just 1
                const response = await fetch(`/cart/set/${item.slug}?quantity=0`, {
                    method: "GET",
                    headers: { "X-Requested-With": "XMLHttpRequest" }
                });

                if (response.ok || response.status === 404) {
                    this.showNotification("Item removed from cart", "success");
                } else {
                    // Restore item if removal failed
                    this.cart.items.push(item);
                    this.showNotification("Failed to remove item", "error");
                }

                this.cart.isLoading = false;
            } catch (error) {
                console.error("Error removing from cart:", error);
                this.showNotification("Item removed locally", "info");
                this.cart.isLoading = false;
            }
        },
        
        getProductCartStatus(productId) {
            const item = this.cart.items.find((item) => item.id === productId);
            
            if (item) {
                return {
                    inCart: true,
                    subscription: item.subscription,
                    quantity: item.quantity,
                    item: item
                };
            }
            
            return {
                inCart: false,
                subscription: null,
                quantity: 0
            };
        },
        
        getAddToCartButtonState(productId, isSubscription) {
            const status = this.getProductCartStatus(productId);
            
            if (!status.inCart) {
                return {
                    disabled: false,
                    text: isSubscription ? "Subscribe" : "Add to Cart",
                    variant: "primary"
                };
            }
            
            if (status.subscription === isSubscription) {
                return {
                    disabled: false,
                    text: `Add Another (${status.quantity} in cart)`,
                    variant: "secondary"
                };
            }
            
            return {
                disabled: true,
                text: `Already in cart as ${status.subscription ? "subscription" : "one-time"}`,
                variant: "disabled"
            };
        },
        
        async updateQuantity(productId, newQuantity) {
            if (!this.isLoggedIn()) {
                this.redirectToLogin("Please log in to modify cart");
                return;
            }
            
            const item = this.cart.items.find((item) => item.id === productId);
            
            if (item && (item.isGift || item.subscription)) {
                if (item.isGift) {
                    this.showNotification("Gift items cannot have quantity changed", "warning");
                } else {
                    this.showNotification("Subscription items are limited to quantity 1", "warning");
                }
                return;
            }
            
            if (newQuantity <= 0) {
                this.removeFromCart(productId);
                return;
            }
            
            if (item) {
                const oldQuantity = item.quantity;
                item.quantity = newQuantity;
                
                try {
                    const formData = new FormData();
                    formData.append("quantity", newQuantity.toString());
                    
                    const response = await fetch(`/cart/set/${item.slug}`, {
                        method: "POST",
                        headers: { "X-Requested-With": "XMLHttpRequest" },
                        body: formData
                    });
                    
                    if (response.ok) {
                        this.showNotification("Quantity updated", "success");
                    } else {
                        item.quantity = oldQuantity;
                        this.showNotification("Failed to update quantity", "error");
                    }
                } catch (error) {
                    console.error("Error updating quantity:", error);
                    this.showNotification("Quantity updated locally", "info");
                }
            }
        },
        
        showNotification(message, type = "info") {
            let notification = document.getElementById("cart-notification");
            
            if (!notification) {
                notification = document.createElement("div");
                notification.id = "cart-notification";
                notification.className = "fixed top-4 right-4 z-50 px-6 py-3 rounded-lg font-medium text-white transform transition-all duration-300 translate-x-full shadow-lg";
                document.body.appendChild(notification);
            }
            
            notification.textContent = message;
            notification.className = notification.className.replace(/bg-\w+-500/g, "");
            
            if (type === "success") {
                notification.classList.add("bg-green-500");
            } else if (type === "error") {
                notification.classList.add("bg-red-500");
            } else if (type === "warning") {
                notification.classList.add("bg-yellow-500");
            } else {
                notification.classList.add("bg-blue-500");
            }
            
            requestAnimationFrame(() => {
                notification.classList.remove("translate-x-full");
            });
            
            setTimeout(() => {
                notification.classList.add("translate-x-full");
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }, 3000);
        }
    };
}

// Hero scroll event listener
window.addEventListener("scroll", () => {
    if (!ticking) {
        requestAnimationFrame(updateHeroScale);
        ticking = true;
    }
});

// Load event listener
window.addEventListener("load", () => {
    hero.style.transform = "scale(1)";
    updateHeroScale();
});

// Initial hero setup
hero.style.transform = "scale(1)";
updateHeroScale();

// Clipboard functionality
if (typeof ClipboardJS !== "undefined") {
    new ClipboardJS("#copy");
    
    $("#copy").on("click", function () {
        const textElement = $(this).find("p");
        textElement.text("COPIED");
        setTimeout(() => textElement.text("Copy IP"), 2000);
    });
}

// Minecraft server status
if (typeof MinecraftAPI !== "undefined") {
    MinecraftAPI.getServerStatus(server, { port: serverPort }, function (error, status) {
        if (!error && status.players) {
            animateCount(document.querySelector("#copy .count"), status.players.now);
        } else {
            animateCount(document.querySelector("#copy .count"), 0);
        }
    });
}

// Discord server status
if (discordId) {
    $.get("https://discordapp.com/api/guilds/" + discordId + "/embed.json", function (data) {
        animateCount(document.querySelector("#discord .count"), data.presence_count);
    });
}

// Escape key handler
document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
        const alpineData = Alpine.$data(document.body);
        
        if (alpineData && alpineData.modal && alpineData.modal.isOpen) {
            alpineData.closeModal();
        } else if (alpineData && alpineData.cart && alpineData.cart.isOpen) {
            alpineData.toggleCart();
        }
    }
});

// Alpine.js fallback loader
if (typeof Alpine === "undefined") {
    const alpineScript = document.createElement("script");
    alpineScript.src = "https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js";
    alpineScript.defer = true;
    document.head.appendChild(alpineScript);
}
