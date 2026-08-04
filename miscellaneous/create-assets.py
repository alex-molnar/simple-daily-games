from PIL import Image, ImageChops
from requests import get
from io import BytesIO
from json import load

with open('input.json', 'r') as f:
    data = load(f)

# TODO: exclude from game after data migration
# rerun_cases = {
#     "caribbean-netherlands": "https://www.countryflags.com/wp-content/uploads/netherlands-flag-png-large.png",
#     "french-guiana": "https://www.countryflags.com/wp-content/uploads/france-flag-png-large.png",
# }

failures = []

for country in data.values():
    try:
        name = country['name'].lower().replace(' ', '-')
        response = get(f'https://www.countryflags.com/wp-content/uploads/{name}-flag-png-large.png')
        if response.status_code == 200:
            bytes = BytesIO(response.content)
            grayscale_img = Image.open(bytes).convert('L')
            grayscale_img.save(f'assets/grayscale/{name}.png')
            print(f'Successfully created grayscale image for {name}')
            img = Image.open(bytes)
            inv_img = ImageChops.invert(img)
            inv_img.save(f'assets/invertedle/{name}.png')
            print(f'Successfully created inverted image for {name}')
            img.save(f'assets/original/{name}.png')
            print(f'Successfully created original image for {name}')
        else:
            print(f'Failed to create inverted/grayscaled image for {name}: HTTP {response.status_code}')
            failures.append(name)
    except Exception as e:
        print(f'Failed to create inverted/grayscaled image for {name}: {e}')
        failures.append(name)

print(failures)