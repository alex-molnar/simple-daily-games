from csv import reader
from random import shuffle
from datetime import datetime, timedelta

five_mil = 5000000
mil = 1000000
ten_k = 10000
k = 1000

class Concap:
    def __init__(self, data: list):
        self.CountryName = data[0]
        self.CapitalName = data[1]
        self.CapitalLatitude = float(data[2])
        self.CapitalLongitude = float(data[3])
        self.CountryCode = data[4]
        self.ContinentName = data[5]

    def __str__(self):
        return f'''
{self.CountryName}
{self.CapitalName}
{self.CapitalLatitude}
{self.CapitalLongitude}
{self.CountryCode}
{self.ContinentName}
'''

class Gist:
    def __init__(self, data: list):
        self.Country = data[0]
        self.CapitalCity = data[1]
        self.Latitude = float(data[2])
        self.Longitude = float(data[3])
        self.Population = data[4]
        self.CapitalType = data[5]

    def __str__(self):
        return f'''
{self.Country}
{self.CapitalCity}
{self.Latitude}
{self.Longitude}
{self.Population}
{self.CapitalType}
'''

class Capital:
    def __init__(self, concap: Concap, gist: Gist):
        self.name = f'{concap.CapitalName} ({concap.CountryName})'
        self.hemisphere = 'Northern' if gist.Latitude >= 0 else 'Southern'
        self.continent = concap.ContinentName
        self.population = int(gist.Population)
        self.latitude = gist.Latitude
        self.longitude = gist.Longitude

    def getPopulation(self):
        if self.population // five_mil > 0:
            return f'{round(self.population / mil)}m'
        elif self.population // mil > 0:
            return f'{round(self.population / mil, 1)}m'
        elif self.population // ten_k > 0:
            return f'{round(self.population / k)}k'
        else:
            return f'{self.population}'

    def asJson(self):
        return f'''    "{self.name}": {{
        "name": "{self.name}",
        "hemisphere": "{self.hemisphere}",
        "continent": "{self.continent}",
        "population": {self.population},
        "pretty_population": "{self.getPopulation()}",
        "latitude": {self.latitude},
        "longitude": {self.longitude}
    }}'''

    def __str__(self):
        return f'''
{self.name}
{self.hemisphere}
{self.continent}
{self.population}
{self.latitude}
{self.longitude}
'''
    
class Country(Capital):
    def __init__(self, concap: Concap, gist: Gist):
        super().__init__(concap, gist)
        self.country = concap.CountryName

    def asJson(self):
        return f'''    "{self.country}": {{
        "name": "{self.country}",
        "hemisphere": "{self.hemisphere}",
        "continent": "{self.continent}",
        "population": {self.population},
        "pretty_population": "{self.getPopulation()}",
        "latitude": {self.latitude},
        "longitude": {self.longitude}
    }}'''

    def __str__(self):
        return super().__str__() + '\n' + self.country


with open('concap.csv', 'r') as concap_f:
    with open('gist.csv', 'r') as gist_f:
        concaps = {concap[1]: Concap(concap) for concap in reader(concap_f) if concap[0] != 'CountryName'}
        gists = {gist[1]: Gist(gist) for gist in reader(gist_f) if gist[0] != 'Country'}
        capitals = list()
        countries = list()

        for (concap_k, concap_v) in concaps.items():
            if concap_k in gists:
                capitals.append(Capital(concap_v, gists[concap_k]))
                countries.append(Country(concap_v, gists[concap_k]))
            else:
                print(f'{concap_k} ({concap_v.CountryName}) is in concap but not in gist')

        print('====================================================================================')

        for (gist_k, gist_v) in gists.items():
            if gist_k not in concaps:
                print(f'{gist_k} ({gist_v.Country}) is in gist but not in concap')

        shuffle(capitals)
        shuffle(countries)

        with open('src/capitale-data.js', 'w') as data_f:
            data_f.write("const capitals_data = {\n")
            data_f.write(',\n'.join(map(lambda c: c.asJson(), capitals)))
            data_f.write('\n}\n')
            data_f.write('\nconst capitals = Object.keys(capitals_data);\n')

        with open('src/countryle-data.js', 'w') as data_f:
            data_f.write("const countries_data = {\n")
            data_f.write(',\n'.join(map(lambda c: c.asJson(), countries)))
            data_f.write('\n}\n')
            data_f.write('\nconst countries = Object.keys(countries_data);\n')

