from bs4 import BeautifulSoup

with open("file.html" , "r") as f:
    html = f.read()

soup = BeautifulSoup(html , 'html.parser')

print(soup.prettify())

print(soup.get_text())

with open("file2.html" , "w") as f2:
    f2.write(soup.prettify())