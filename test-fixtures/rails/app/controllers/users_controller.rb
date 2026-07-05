class UsersController < ApplicationController
  skip_before_action :verify_authenticity_token

  def create
    @user = User.new(params[:user])
    @user.save
  end

  def update
    User.update(params[:user])
  end

  def show_bio
    render inline: @user.bio.html_safe
  end

  def search
    User.where("name = '#{params[:name]}'")
  end

  def call_method
    @user.send(params[:method_name])
  end

  def go_back
    redirect_to params[:return_url]
  end

  def bulk_update
    @user.update(params.permit!)
  end

  def restore_session
    data = Marshal.load(cookies[:session_data])
  end
end
