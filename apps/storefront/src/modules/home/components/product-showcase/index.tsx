const ProductShowcase = () => {
  return (
    <div className="bg-white py-20">
      <div className="container mx-auto px-4">
        <div className="grid items-center gap-16 lg:grid-cols-2">
          {/* Left Content */}
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="font-medium text-green-600 text-sm uppercase tracking-wide">
                Bienvenido
              </div>

              <h2 className="font-light text-4xl text-gray-900 leading-tight lg:text-5xl">
                Nuestra esencia
                <br />
                se basa en la
                <br />
                <span className="text-green-600">calidad en perfumes</span>
              </h2>
            </div>

            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="mb-2 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                  <div className="h-8 w-8 rounded-full bg-green-500" />
                </div>
                <div className="font-bold text-2xl text-gray-900">110+</div>
                <div className="text-gray-600 text-sm">Tienda</div>
              </div>

              <div className="max-w-xs text-gray-600 text-sm">
                Perfumería de calidad cerca tuyo
              </div>
            </div>
          </div>

          {/* Right Content - Product Grid */}
          <div className="relative">
            <div className="grid grid-cols-2 gap-4">
              {/* Product 1 */}
              <div className="flex aspect-square flex-col justify-between rounded-2xl bg-gradient-to-br from-yellow-200 to-yellow-400 p-6">
                <div className="text-right">
                  <div className="font-medium text-sm text-yellow-800">
                    33 Fragancias
                  </div>
                  <div className="text-xs text-yellow-700">
                    Todas las fragancias tienen
                  </div>
                  <div className="text-xs text-yellow-700">
                    Perfección en perfume
                  </div>
                </div>
                <div className="text-center">
                  <div className="mx-auto mb-2 h-20 w-16 rounded-lg bg-yellow-600" />
                  <div className="font-medium text-xs text-yellow-800">
                    AROMAS FLORALES
                  </div>
                  <div className="text-xs text-yellow-700">$59.00</div>
                </div>
              </div>

              {/* Product 2 */}
              <div className="flex aspect-square flex-col justify-between rounded-2xl bg-gradient-to-br from-green-200 to-green-400 p-6">
                <div className="text-right">
                  <div className="font-medium text-green-800 text-sm">
                    15 Estilos
                  </div>
                  <div className="text-green-700 text-xs">
                    Elegante y sofisticado
                  </div>
                  <div className="text-green-700 text-xs">
                    aroma natural
                  </div>
                </div>
                <div className="text-center">
                  <div className="mx-auto mb-2 h-20 w-16 rounded-lg bg-green-600" />
                  <div className="font-medium text-green-800 text-xs">
                    AROMAS CÍTRICOS
                  </div>
                  <div className="text-green-700 text-xs">$69.00</div>
                </div>
              </div>

              {/* Product 3 */}
              <div className="flex aspect-square flex-col justify-between rounded-2xl bg-gradient-to-br from-red-200 to-red-400 p-6">
                <div className="text-right">
                  <div className="font-medium text-red-800 text-sm">
                    22 Colecciones
                  </div>
                  <div className="text-red-700 text-xs">
                    Calidad premium con
                  </div>
                  <div className="text-red-700 text-xs">aroma de larga duración</div>
                </div>
                <div className="text-center">
                  <div className="mx-auto mb-2 h-20 w-16 rounded-lg bg-red-600" />
                  <div className="font-medium text-red-800 text-xs">
                    AROMAS FRUTALES
                  </div>
                  <div className="text-red-700 text-xs">$89.00</div>
                </div>
              </div>

              {/* How it works */}
              <div className="flex aspect-square flex-col items-center justify-center space-y-4 rounded-2xl bg-gray-100 p-6 text-center">
                <h3 className="font-bold text-gray-900 text-lg">
                  Cómo funciona
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 font-bold text-white text-xs">
                      1
                    </div>
                    <div className="text-gray-700 text-xs">Buscá el producto</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 font-bold text-white text-xs">
                      2
                    </div>
                    <div className="text-gray-700 text-xs">Elegí el producto</div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-500 font-bold text-white text-xs">
                      3
                    </div>
                    <div className="text-gray-700 text-xs">Encontrá el producto</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductShowcase;
