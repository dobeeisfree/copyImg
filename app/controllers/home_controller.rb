class HomeController < ApplicationController
    def index
        @pine_art = ["gogh", "mona", "pica", "scream"]
        @rand = @pine_art.sample
        @img_name = @rand + ".jpg"
    end
end
