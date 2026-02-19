import json

def load_products():
    try:
        with open("products.json", "r") as f:
            return json.load(f)
    except:
        return []

def save_products(products):
    with open("products.json", "w") as f:
        json.dump(products, f, indent=4)

def generate_id(products):
    if not products:
        return 1
    return products[-1]["id"] + 1

def add_product(products):
    pid = generate_id(products)
    name = input("Name: ")
    category = input("Category: ")
    price = float(input("Price: "))
    quantity = int(input("Quantity: "))

    products.append({
        "id": pid,
        "name": name,
        "category": category,
        "price": price,
        "quantity": quantity
    })

    save_products(products)

def display_products(products):
    # for p in products:
    #     print(p)
    print("ID   Name       Category     Price   Quantity")
    print("-" * 55)

    for p in products:
        print(f"{p['id']:<4} {p['name']:<10} {p['category']:<12} {p['price']:<7} {p['quantity']}")

def update_product(products):
    pid = int(input("Enter ID: "))

    for p in products:
        if p["id"] == pid:
            p["price"] = float(input("New price: "))
            p["quantity"] = int(input("New quantity: "))
            save_products(products)
            return

    print("Product not found")

def delete_product(products):
    pid = int(input("Enter ID: "))

    for p in products:
        if p["id"] == pid:
            products.remove(p)
            save_products(products)
            return

    print("Product not found")

def search_product(products):
    pid = int(input("Enter ID: "))

    for p in products:
        if p["id"] == pid:
            print(p)
            return

    print("Not found")

def low_stock(products):
    for p in products:
        if p["quantity"] < 5:
            print(p)

products = load_products()

while True:
    print("1 Add")
    print("2 Display")
    print("3 Update")
    print("4 Delete")
    print("5 Search")
    print("6 Low stock")
    print("7 Exit")

    choice = input("Choice: ")

    if choice == "1":
        add_product(products)
    elif choice == "2":
        display_products(products)
    elif choice == "3":
        update_product(products)
    elif choice == "4":
        delete_product(products)
    elif choice == "5":
        search_product(products)
    elif choice == "6":
        low_stock(products)
    elif choice == "7":
        break

